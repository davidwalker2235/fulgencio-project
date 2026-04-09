const TARGET_API_URL =
  process.env.ROBOT_AGENT_NUMERIC_CODE_API_URL ??
  "https://robot-agent.enricd.com/api/tools/draw_robot_caricature";
const TARGET_API_AUTHORIZATION =
  process.env.ROBOT_AGENT_API_AUTHORIZATION ??
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmcm9udGVuZCJ9.t6chSAgaDIMVtC-AX0D_pQKWqnjk5piDLvgwZp9mhnE";

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
      `${TARGET_API_URL}?user_id=${encodeURIComponent(userId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: TARGET_API_AUTHORIZATION,
        },
        body: "{}",
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
