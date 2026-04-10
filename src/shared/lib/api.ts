import { NextResponse } from "next/server";

export function jsonResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function notFound(resource: string) {
  return errorResponse(`${resource} not found`, 404);
}

export function forbidden() {
  return errorResponse("Forbidden", 403);
}

export function unauthorized() {
  return errorResponse("Unauthorized", 401);
}
