import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { CodeMirrorFileOpener } from "@/components/FileEditor";
import { CLAIMED_EXTENSIONS } from "@/lib/languages";

export default definePluginApp((app) => {
  app.slots.fileOpener({
    id: "codemirror",
    title: "CodeMirror Editor",
    extensions: CLAIMED_EXTENSIONS,
    component: CodeMirrorFileOpener,
  });
});
