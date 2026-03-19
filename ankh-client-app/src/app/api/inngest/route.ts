// API route for Inngest serve
import { serve } from "inngest/next";
import { processImport } from "../../../inngest/functions/processImport";
import { inngest } from "../../../inngest/client";

export const { GET, POST } = serve({ client: inngest, functions: [processImport] });
