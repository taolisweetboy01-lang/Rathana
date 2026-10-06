/**
 * MASTER AI ANALYSIS - REAL MEMBER DATABASE SERVERLESS FUNCTION
 * Endpoint: /.netlify/functions/members
 * Supports GET, POST, PUT, DELETE
 */

interface HandlerEvent {
  httpMethod: string;
  body?: string;
  queryStringParameters?: Record<string, string | undefined>;
}

// In-memory runtime persistence across warm invocations
let serverMembers: any[] = [];

export async function handler(event: HandlerEvent) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    if (event.httpMethod === "GET") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(serverMembers),
      };
    }

    if (event.httpMethod === "POST") {
      if (!event.body) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing payload" }) };
      }
      const newMember = JSON.parse(event.body);
      serverMembers = [newMember, ...serverMembers.filter((m) => m.id !== newMember.id)];
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(newMember),
      };
    }

    if (event.httpMethod === "PUT") {
      if (!event.body) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing payload" }) };
      }
      const updated = JSON.parse(event.body);
      serverMembers = serverMembers.map((m) => (m.id === updated.id ? updated : m));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(updated),
      };
    }

    if (event.httpMethod === "DELETE") {
      const id = event.queryStringParameters?.id;
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing member id" }) };
      }
      serverMembers = serverMembers.filter((m) => m.id !== id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, deletedId: id }),
      };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Database API error" }),
    };
  }
}
