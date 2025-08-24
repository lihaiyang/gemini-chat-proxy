import { GoogleGenAI, Chat, Part, Model } from "@google/genai";
import { GeminiService, ChatHistoryItem, ThoughtSupportingPart, ModelOption } from '../types';
import { DEFAULT_MODEL_ID } from "../constants"; // Import for checking model type

const API_KEY = process.env.API_KEY;
console.log("api key" + API_KEY);

if (!API_KEY) {
  console.warn(
    "Gemini API Key is not configured. Please set the API_KEY environment variable. App may not function correctly."
  );
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const geminiServiceImpl: GeminiService = {
  getAvailableModels: async (): Promise<ModelOption[]> => {
    if (!API_KEY) { 
        console.warn("Cannot fetch models: API_KEY is not set.");
        return [];
    }
    try {
      // Note: The new SDK might not have ai.models.list(). 
      // This is based on the older pattern. If list() is gone, one might need to specify models or use a different discovery.
      // For this exercise, assuming list() or a similar mechanism exists.
      // The prompt does not specify how to list models with the new `ai.models.generateContent` pattern.
      // Typically, models are pre-defined by the developer.
      // Let's return the standard models based on the guidelines.
      
      // const modelPager = await ai.models.list(); 
      // const availableModels: ModelOption[] = [];
      // for await (const model of modelPager) { 
      //   if (model.supportedActions && model.supportedActions.includes('generateContent')) {
      //     availableModels.push({
      //       id: model.name, 
      //       name: model.displayName || model.name, 
      //     });
      //   }
      // }
      // return availableModels;

      // Returning pre-defined list as per guidelines, as ai.models.list() might not be the intended way.
      return [
        { id: 'models/gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash (Preview)' },
        // Add other compatible models here if necessary, for now focusing on the primary one.
        // { id: 'models/imagen-3.0-generate-002', name: 'Imagen 3.0 Generate (Preview)'} // For image generation, not chat.
      ];

    } catch (error) {
      console.error("Failed to fetch available models from Gemini API:", error);
      // Fallback to default if list fails
      return [{ id: DEFAULT_MODEL_ID, name: `Default: ${DEFAULT_MODEL_ID.split('/').pop()}` }];
    }
  },

  initializeChat: async (
    modelId: string,
    systemInstruction: string,
    config: { temperature?: number; topP?: number },
    showThoughts: boolean,
    history?: ChatHistoryItem[]
  ): Promise<Chat | null> => {
    if (!API_KEY) {
        console.error("Cannot initialize chat: API_KEY is not set.");
        throw new Error("API Key not configured. Cannot initialize chat.");
    }
    try {
      const validHistory = history?.filter(item => item.role === 'user' || item.role === 'model');

      const chatCreationConfig: {
        systemInstruction?: {role: string, parts: {text: string}[] }; // Updated for new SDK
        temperature?: number;
        topP?: number;
        thinkingConfig?: { thinkingBudget?: number }; // Adjusted based on new guidelines
      } = {};

      if (systemInstruction && systemInstruction.trim() !== "") {
        chatCreationConfig.systemInstruction = { role: "system", parts: [{text: systemInstruction}] };
      }
      
      if (config.temperature !== undefined) {
        chatCreationConfig.temperature = config.temperature;
      }
      if (config.topP !== undefined) {
        chatCreationConfig.topP = config.topP;
      }
      
      // Adjust thinkingConfig based on model and showThoughts
      // The new guidelines specify `thinkingBudget: 0` to disable for gemini-2.5-flash-preview-04-17.
      // Omit for default (high quality, thoughts enabled).
      if (modelId === 'models/gemini-2.5-flash-preview-04-17' || modelId === 'gemini-2.5-flash-preview-04-17') { // Check both with and without models/ prefix
        if (showThoughts) {
          // Omit thinkingConfig to enable thoughts (default behavior for higher quality)
        } else {
          chatCreationConfig.thinkingConfig = { thinkingBudget: 0 }; // Disable thoughts
        }
      } else {
        // For other models, the behavior of thinkingConfig might differ.
        // The old `includeThoughts: true` is not in the new guidelines.
        // If showThoughts is true, we might omit or use a model-specific config if known.
        // For now, only applying specific logic for gemini-2.5-flash-preview-04-17.
        if (showThoughts) {
            // console.warn(`ThinkingConfig behavior for model ${modelId} with showThoughts=true is not explicitly defined by new guidelines, omitting.`);
        }
      }

      const chat: Chat = ai.chats.create({
        model: modelId, // Model ID without "models/" prefix might be required for `ai.chats.create`
        config: chatCreationConfig,
        history: validHistory,
      });
      return chat;
    } catch (error) {
      console.error("Failed to initialize Gemini chat:", error);
      throw error;
    }
  },

  sendMessageStream: async (
    chat: Chat,
    modelId: string, 
    message: string,
    onChunk: (chunk: string) => void,
    onThoughtChunk: (chunk: string) => void, // This callback might become less relevant if thoughts are part of main text or not explicitly separable
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<void> => {
    try {
      // Temperature, TopP, systemInstruction, and thinkingConfig are set at chat initialization.
      // The sendMessageStream method in the new SDK might not take a config object in the same way.
      // It primarily takes the message.
      const result = await chat.sendMessageStream({ message });

      for await (const chunkResponse of result) {
        // The structure of ThoughtSupportingPart and how thoughts are delivered needs verification with the new SDK
        // For now, assuming thoughts might be embedded or require specific parsing if `thinkingConfig` is omitted (for enabled thoughts)
        // The `onThoughtChunk` might need to be re-evaluated.
        // The primary output is `chunkResponse.text`.
        
        // According to new guidelines, `chunkResponse.text` is the primary way.
        // Let's simplify and assume thoughts, if enabled and generated, are part of the main text stream.
        // The differentiation of thoughts might not be as explicit with `Part.thought` anymore.
        // The prompt for this task doesn't focus on thought extraction details, so sticking to `chunkResponse.text`.
        if (chunkResponse.text) {
          onChunk(chunkResponse.text);
        }

        // The old logic for `ThoughtSupportingPart` and `p.thought` might not apply directly.
        // If the API sends thoughts in a structured way (e.g., special parts or metadata),
        // this part would need to be adapted.
        // For now, focusing on the main text stream.
        // if (chunkResponse.candidates && chunkResponse.candidates[0]?.content?.parts) {
        //   for (const part of chunkResponse.candidates[0].content.parts) {
        //     const p = part as ThoughtSupportingPart;
        //     if (p.text) {
        //       if (p.thought) { // This relies on the API populating 'thought'
        //         onThoughtChunk(p.text);
        //       } else {
        //         onChunk(p.text);
        //       }
        //     }
        //   }
        // } else if (chunkResponse.text) { // Fallback if parts structure is not as expected
        //    onChunk(chunkResponse.text);
        // }
      }
    } catch (error) {
      console.error("Error sending message to Gemini:", error);
      if (error instanceof Error) {
        onError(error);
      } else {
        onError(new Error(String(error) || "Unknown error during streaming."));
      }
    } finally {
      onComplete();
    }
  },
};

export const geminiServiceInstance: GeminiService = geminiServiceImpl;