const TARGET_API_URL =
  process.env.ROBOT_AGENT_NUMERIC_CODE_API_URL ??
  `${process.env.BACKEND_API_URL ?? (process.env.NODE_ENV === "production" ? "http://backend:8000" : "http://localhost:8000")}/robot/submit-number`;
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id")?.trim();

  if (!userId) {
    return Response.json(
      { error: "Missing required query param: user_id" },
      { status: 400 },
    );
  }

  try {
    const upstreamResponse = await fetch(
      TARGET_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
      },
    );

    const contentType = upstreamResponse.headers.get("content-type") ?? "";
    const responseBody = contentType.includes("application/json")
      ? await upstreamResponse.json()
      : await upstreamResponse.text();

    return Response.json(
      {
        ok: upstreamResponse.ok,
        status: upstreamResponse.status,
        data: responseBody,
      },
      { status: upstreamResponse.status },
    );
  } catch (error) {
    return Response.json(
      {
        error: "Failed to contact upstream API",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
