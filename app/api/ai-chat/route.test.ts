import { POST } from "./route";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

jest.mock("@prisma/client", () => {
  const mPrismaClient = {
    conversation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    message: {
      create: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

describe("POST /api/ai-chat", () => {
  let prisma: any;

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();
  });

  function createNextRequest(body: any) {
    return {
      json: () => Promise.resolve(body),
    } as unknown as NextRequest;
  }

  it("returns error if query is missing or not a string", async () => {
    const req = createNextRequest({ query: 123, model: "scira" });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Query is required and must be a string");
  });

  it("returns error if model is invalid", async () => {
    const req = createNextRequest({ query: "hello", model: "invalid-model" });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Valid model selection is required");
  });

  it("returns error if TOGETHER_API_KEY is not set", async () => {
    const originalKey = process.env.TOGETHER_API_KEY;
    delete process.env.TOGETHER_API_KEY;

    const req = createNextRequest({ query: "hello", model: "scira" });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.error).toBe("TOGETHER API key not configured");

    process.env.TOGETHER_API_KEY = originalKey;
  });

  it("loads conversation by conversationId and returns messages", async () => {
    const mockConversation = {
      id: "conv1",
      messages: [
        { id: "msg1", content: "Hello", isUser: true, createdAt: new Date() },
        { id: "msg2", content: "Hi there", isUser: false, createdAt: new Date() },
      ],
    };
    prisma.conversation.findUnique.mockResolvedValue(mockConversation);
    prisma.message.create.mockResolvedValue({});

    process.env.TOGETHER_API_KEY = "dummy_key";

    const req = createNextRequest({
      query: "test query",
      model: "scira",
      conversationId: "conv1",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
      where: { id: "conv1" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    expect(json.conversationId).toBe("conv1");
    expect(json.messages).toEqual(mockConversation.messages);
  });

  it("loads conversation by userId and returns messages", async () => {
    const mockConversation = {
      id: "conv2",
      messages: [
        { id: "msg3", content: "User message", isUser: true, createdAt: new Date() },
        { id: "msg4", content: "AI response", isUser: false, createdAt: new Date() },
      ],
    };
    prisma.conversation.findFirst.mockResolvedValue(mockConversation);
    prisma.conversation.create.mockResolvedValue(mockConversation);
    prisma.message.create.mockResolvedValue({});

    process.env.TOGETHER_API_KEY = "dummy_key";

    const req = createNextRequest({
      query: "test query",
      model: "scira",
      userId: "user1",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { userId: "user1" },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    expect(json.conversationId).toBe("conv2");
    expect(json.messages).toEqual(mockConversation.messages);
  });

  it("returns 404 if conversation not found by conversationId", async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);

    process.env.TOGETHER_API_KEY = "dummy_key";

    const req = createNextRequest({
      query: "test query",
      model: "scira",
      conversationId: "nonexistent",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Conversation not found");
  });
});
