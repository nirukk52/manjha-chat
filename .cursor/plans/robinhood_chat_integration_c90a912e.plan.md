---
name: Robinhood Chat Integration
overview: Implement TypeScript-based Robinhood integration tools for the chat app with session-only authentication, a dedicated login popup for secure credential entry, enabling users to connect their Robinhood account, view portfolio, get quotes, and analyze positions through natural language.
todos:
  - id: robinhood-client
    content: Create lib/robinhood/client.ts - TypeScript client for Robinhood API with session management
    status: completed
  - id: robinhood-types
    content: Create lib/robinhood/types.ts - Type definitions for API responses
    status: completed
  - id: robinhood-login-dialog
    content: Create components/robinhood-login-dialog.tsx - Secure popup for email, password, and MFA entry
    status: completed
  - id: robinhood-auth-api
    content: Create app/(chat)/api/robinhood/route.ts - API endpoint for login, status check, and logout
    status: completed
  - id: robinhood-tools
    content: Create lib/ai/tools/robinhood.ts - AI tools for portfolio, positions, quotes, account (login triggers popup)
    status: completed
  - id: update-chat-route
    content: Update app/(chat)/api/chat/route.ts - Register new Robinhood tools
    status: completed
  - id: update-prompts
    content: Update lib/ai/prompts.ts - Add Robinhood-specific guidance to system prompt
    status: completed
isProject: false
---

# Robinhood Chat Integration Plan

## Architecture Overview

```mermaid
flowchart TB
    subgraph ui [User Interface]
        SuggestedAction[One tap connect button]
        ChatInput[Chat Input]
        LoginDialog[Robinhood Login Popup]
    end
    
    subgraph chatAPI [Chat API Routes]
        ChatRoute["api/chat/route.ts"]
        RHAuthRoute["api/robinhood/route.ts"]
        Tools[AI Tools Registry]
    end
    
    subgraph robinhoodTools [Robinhood Tools]
        ConnectTool[robinhoodConnect]
        Portfolio[robinhoodGetPortfolio]
        Quote[robinhoodGetQuote]
        Positions[robinhoodGetPositions]
        Account[robinhoodGetAccount]
    end
    
    subgraph robinhoodLib [Robinhood Client Library]
        Client[RobinhoodClient]
        SessionStore["In-Memory Session Store"]
    end
    
    subgraph external [External]
        RobinhoodAPI[Robinhood API]
    end
    
    SuggestedAction --> ChatInput
    ChatInput --> ChatRoute
    ChatRoute --> Tools
    Tools --> ConnectTool
    ConnectTool -.->|triggers| LoginDialog
    LoginDialog -->|credentials| RHAuthRoute
    RHAuthRoute --> Client
    Tools --> Portfolio
    Tools --> Quote
    Tools --> Positions
    Tools --> Account
    Portfolio --> Client
    Quote --> Client
    Positions --> Client
    Account --> Client
    Client --> SessionStore
    Client --> RobinhoodAPI
```

## Login Flow

```mermaid
sequenceDiagram
    participant User
    participant Chat
    participant AI
    participant LoginPopup
    participant AuthAPI
    participant Robinhood
    
    User->>Chat: "Connect my Robinhood account"
    Chat->>AI: Process message
    AI->>Chat: Call robinhoodConnect tool
    Chat->>LoginPopup: Open popup
    User->>LoginPopup: Enter email and password
    LoginPopup->>AuthAPI: POST /api/robinhood (login)
    AuthAPI->>Robinhood: Authenticate
    Robinhood-->>AuthAPI: MFA required
    AuthAPI-->>LoginPopup: Request MFA code
    LoginPopup->>User: Show MFA input
    User->>LoginPopup: Enter MFA code
    LoginPopup->>AuthAPI: POST /api/robinhood (verify MFA)
    AuthAPI->>Robinhood: Verify MFA
    Robinhood-->>AuthAPI: Access token
    AuthAPI-->>LoginPopup: Success
    LoginPopup->>Chat: Connection complete
    AI->>User: "Connected! What would you like to know?"
```

## Implementation Details

### 1. Create Robinhood Client Library

**File**: `lib/robinhood/client.ts`

Create a TypeScript client for the Robinhood unofficial API based on [sanko/Robinhood API documentation](https://github.com/sanko/Robinhood):

```typescript
// Core functionality:
- login(email, password, mfaCode?) - Authenticate and get access token
- getAccount() - Fetch account details
- getPortfolio() - Fetch portfolio summary
- getPositions() - Fetch current stock positions
- getQuote(symbol) - Get real-time stock quote
- logout() - Clear session
```

**Session Management**: Use an in-memory Map keyed by user ID to store tokens (cleared on server restart - session-only as requested).

### 2. Create Robinhood Login Dialog

**File**: `components/robinhood-login-dialog.tsx`

A secure popup dialog using existing [dialog.tsx](components/ui/dialog.tsx) primitives:

- **Step 1**: Email and password form fields
- **Step 2**: MFA code input (if required by Robinhood)
- **Success state**: Shows connected confirmation
- **Error handling**: Displays login failures with retry option

Features:

- Password field with type="password" (never visible)
- Loading states during API calls
- Automatic focus management
- Accessible form labels

### 3. Create Robinhood Auth API

**File**: `app/(chat)/api/robinhood/route.ts`

Dedicated API endpoint for Robinhood authentication (separate from chat):

- `POST /api/robinhood` - Login with email/password, or verify MFA
- `GET /api/robinhood` - Check connection status
- `DELETE /api/robinhood` - Logout and clear session

### 4. Create AI Tools

**File**: `lib/ai/tools/robinhood.ts`

Define 5 tools using the existing pattern from [get-weather.ts](lib/ai/tools/get-weather.ts):

| Tool | Purpose | Triggers Popup |

|------|---------|----------------|

| `robinhoodConnect` | Initiate connection (triggers login popup) | Yes |

| `robinhoodGetAccount` | Get account info (buying power, etc.) | No (requires auth) |

| `robinhoodGetPortfolio` | Get portfolio value and P&L | No (requires auth) |

| `robinhoodGetPositions` | List all stock positions | No (requires auth) |

| `robinhoodGetQuote` | Get quote for a stock symbol | No (public) |

The `robinhoodConnect` tool returns a special response that the frontend interprets to open the login popup.

All tools will use `needsApproval: true` for security.

### 5. Update Chat API Route

**File**: `app/(chat)/api/chat/route.ts`

- Import new Robinhood tools
- Add to `experimental_activeTools` array
- Add to `tools` object
```typescript
experimental_activeTools: [
  "getWeather",
  "createDocument",
  // ... existing
  "robinhoodConnect",
  "robinhoodGetAccount",
  "robinhoodGetPortfolio",
  "robinhoodGetPositions",
  "robinhoodGetQuote",
],
tools: {
  // ... existing
  robinhoodConnect,
  robinhoodGetAccount,
  robinhoodGetPortfolio,
  robinhoodGetPositions,
  robinhoodGetQuote,
},
```


### 6. Update System Prompt

**File**: `lib/ai/prompts.ts`

Add instructions for Robinhood tools:

```typescript
// Add to systemPrompt:
- When user wants to connect Robinhood, use robinhoodConnect tool (triggers secure popup)
- How to present portfolio data clearly (tables, percentages, gains/losses)
- Security reminders: credentials entered in popup, never in chat
- If not connected, prompt user to connect first
```

### 7. Integrate Login Dialog in Chat

**File**: `components/chat.tsx`

- Import and render `RobinhoodLoginDialog` component
- Listen for tool responses that trigger the popup
- Handle connection success/failure callbacks

## Robinhood API Endpoints Used

Based on the [unofficial Robinhood API documentation](https://github.com/sanko/Robinhood):

- `POST /oauth2/token` - Authentication
- `GET /accounts/` - Account info
- `GET /portfolios/` - Portfolio data
- `GET /positions/` - Stock positions
- `GET /quotes/{symbol}/` - Stock quotes
- `POST /oauth2/revoke_token` - Logout

## Security Considerations

- **Session-only tokens**: Stored in memory, cleared on restart
- **Tool approval required**: All tools have `needsApproval: true`
- **No credential persistence**: Email/password never stored
- **HTTPS only**: All API calls over secure connection
- **User-scoped sessions**: Tokens keyed by authenticated user ID

## File Changes Summary

| File | Action |

|------|--------|

| `lib/robinhood/client.ts` | Create (new) |

| `lib/robinhood/types.ts` | Create (new) |

| `components/robinhood-login-dialog.tsx` | Create (new) |

| `app/(chat)/api/robinhood/route.ts` | Create (new) |

| `lib/ai/tools/robinhood.ts` | Create (new) |

| `app/(chat)/api/chat/route.ts` | Modify |

| `lib/ai/prompts.ts` | Modify |

| `components/chat.tsx` | Modify |