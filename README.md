# Lincoln – AI Context Linker

Lincoln is a Chrome extension designed to seamlessly link AI conversations across different chats and platforms. It allows you to preserve the full context of a conversation and inject it into a new session—even on a different AI model—without manually copying and pasting text or relying on summarized histories.

## Why This Extension Is Needed

Working with Large Language Models (LLMs) often involves fragmented workflows. 
*   **Context Loss:** Starting a new chat wipes the slate clean, meaning you lose all prior instructions and context.
*   **Platform Silos:** You cannot easily move a conversation from ChatGPT to Gemini. Shared links from ChatGPT cannot be read by Gemini, and vice versa.
*   **Fragile History:** Long conversations become slow or hit token limits, forcing you to restart and lose progress.

Developing complex ideas requires persistent context, which native interfaces currently fail to provide robustly across boundaries.

## What Lincoln Does

Lincoln solves context fragmentation by creating a **Context ID system**:
1.  **Extraction:** It saves your full conversation history from the browser DOM.
2.  **Storage:** It stores this context securely in your local browser storage.
3.  **Injection:** It generates a unique ID (e.g., `context://uuid`). When you paste this ID into a new chat, Lincoln intercepts the message and **invisibly injects** the full previous context along with your new prompt.

This ensures the AI knows exactly what you were talking about, without cluttering your input box with massive blocks of text.

## Key Features

*   **Save Full Conversations:** Capture every message in a chat with a single click.
*   **Partial Selection:** Select specific messages to save relevant parts of a long discussion.
*   **Generate Context IDs:** Create short, referenceable tags for massive context blocks.
*   **Reuse Context Instantly:** Type a Context ID to bring previous history into a new undefined chat.
*   **Cross-Platform Interoperability:** Move context freely between ChatGPT and Gemini.
*   **No Manual Copy-Pasting:** Eliminates the need to scroll, copy, and paste pages of text.

## ⚡ Important Cross-Platform Capability

A critical limitation of current AI tools is their incompatibility. **Native share links do not work across platforms.** You cannot paste a ChatGPT share link into Gemini and expect it to read the content.

**Lincoln bridges this gap.**
With Lincoln, you can save a conversation in **ChatGPT**, generate a Context ID, and paste that ID into **Gemini**. Lincoln will inject the raw text of the ChatGPT conversation into Gemini's context window, allowing you to continue your work seamlessly using a different model.

## How It Works

1.  **Save:** Click the floating "Save" button (or select specific messages) in an active ChatGPT or Gemini conversation.
2.  **Store:** Lincoln extracts the text and saves it to your browser's local database.
3.  **Generate:** You receive a unique Context ID (copied to clipboard automatically).
4.  **Inject:** In a new chat window, paste the Context ID followed by your new prompt.
5.  **Execute:** When you hit send, Lincoln silently replaces the ID with the full saved history before it reaches the AI model.

## How to Run Locally

To run Lincoln locally as a Chrome Extension:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/gityash10/Lincoln.git
    ```
2.  **Open Extensions Management:**
    Open Google Chrome and navigate to `chrome://extensions`.
3.  **Enable Developer Mode:**
    Toggle the switch in the top-right corner labeled "Developer mode".
4.  **Load Extension:**
    Click the **"Load unpacked"** button that appears.
5.  **Select Folder:**
    Select the `ai-context-linker` directory from the cloned repository.

The Lincoln favicon should now appear in your browser toolbar.

## Supported Platforms

| Platform | Status | Notes |
| :--- | :--- | :--- |
| **ChatGPT Web** | ✅ Supported | Full saving and injection support. |
| **Gemini Web** | ✅ Supported | Full saving and injection support. |
| **Cross-Platform** | ✅ Supported | Move context between ChatGPT ↔ Gemini. |
| **Mobile Apps** | ❌ Not Supported | Browser extension API required. |

## Privacy & Security

Lincoln is designed with a **Local-First** architecture:
*   **Local Storage:** All saved conversations are stored in your browser's IndexedDB.
*   **No Servers:** No data is ever sent to an external cloud or server managed by Lincoln.
*   **No Analytics:** The extension does not track your usage or collect metadata.
*   **Direct Injection:** Data is passed directly from your local storage to the AI interface you are using.

## Important Notes & Limitations

*   **UI Dependency:** Lincoln relies on the DOM structure of ChatGPT and Gemini. Significant UI updates by these platforms may temporarily break extraction until the extension is updated.
*   **Token Limits:** While Lincoln helps manage context, you are still bound by the context window limits of the AI model you are using (e.g., GPT-4o, Gemini 1.5 Pro). Very long contexts may be truncated by the model itself.
*   **Browser Only:** This tool works strictly within the web browser environment.

## Project Philosophy

Conversations with AI are a form of knowledge creation. This knowledge should not be disposable or trapped within a single session. Context is the key to continuity. Lincoln was built to respect the effort put into these conversations by ensuring they can be connected, preserved, and reused across the evolving landscape of AI tools.
