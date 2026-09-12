import { createSignal, onMount } from "solid-js";

interface PasswordPromptProps {
  /** True when a previous attempt was rejected. */
  retry: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

/**
 * Modal asking for the password of an encrypted PDF. WKWebView has no
 * native `window.prompt`, so the reader ships its own tiny dialog; the
 * importer awaits the answer through `ImportPdfOptions.onPassword`.
 */
export function PasswordPrompt(props: PasswordPromptProps) {
  const [value, setValue] = createSignal("");
  let inputRef: HTMLInputElement | undefined;
  onMount(() => inputRef?.focus());

  return (
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={props.onCancel}>
      <form
        class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl px-6 py-5 w-80 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); props.onSubmit(value()); }}
      >
        <div>
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Password required</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {props.retry ? "That password didn't work. Try again." : "This PDF is encrypted. Enter its password to open it."}
          </p>
        </div>
        <input
          ref={inputRef}
          type="password"
          value={value()}
          onInput={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") props.onCancel(); }}
          class="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autocomplete="off"
        />
        <div class="flex justify-end gap-2">
          <button type="button" onClick={props.onCancel} class="px-3 py-1.5 text-xs rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700">Cancel</button>
          <button type="submit" class="px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium">Open</button>
        </div>
      </form>
    </div>
  );
}
