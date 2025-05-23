import { title } from "process";

const LANDING_PAGE_ACTIONS = [
  {
    id: "upload",
    title: "Sign a Document",
    action: "Upload",
    description: "Choose a file to upload from your computer.",
    type: "upload",
  },

  {
    id: "create",
    title: "Create a Document",
    action: "New a Document",
    description: "Create a document from scratch.",
    type: "action",
  },
];

export { LANDING_PAGE_ACTIONS };
