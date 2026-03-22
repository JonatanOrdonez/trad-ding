import { syncAllNews } from "@/lib/services/news";

export async function GET() {
  try {
    await syncAllNews();
    return Response.json({ message: "News synchronization completed successfully." });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ detail: `Error during news synchronization: ${msg}` }, { status: 400 });
  }
}
