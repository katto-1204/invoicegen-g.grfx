import { createFileRoute } from "@tanstack/react-router";
import InvoiceGenerator from "@/components/InvoiceGenerator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GEE GRAPHICS - Invoice Generator" },
      {
        name: "description",
        content:
          "Create, preview, and print professional invoices for GEE GRAPHICS printing services.",
      },
      { property: "og:title", content: "GEE GRAPHICS - Invoice Generator" },
      {
        property: "og:description",
        content: "Professional invoice & quotation generator for GEE GRAPHICS.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <InvoiceGenerator />;
}
