---
name: Plaid Investments Integration
overview: Integrate Plaid Investments API to provide one-tap brokerage sync (including IBKR support) following the existing Robinhood integration pattern.
todos:
  - id: env-setup
    content: Add PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV to .env.example and .env
    status: completed
  - id: deps
    content: Install plaid and react-plaid-link packages
    status: completed
  - id: schema
    content: Add plaidItem table to lib/db/schema.ts and run migration
    status: completed
  - id: client
    content: Create lib/plaid/client.ts with Plaid SDK wrapper functions
    status: completed
  - id: types
    content: Create lib/plaid/types.ts with TypeScript interfaces
    status: completed
  - id: api-routes
    content: "Create API routes: link-token, exchange, webhook, holdings, status"
    status: completed
  - id: ui-component
    content: Create components/plaid-link-dialog.tsx with react-plaid-link
    status: completed
  - id: ai-tools
    content: Add Plaid AI tools to lib/ai/tools/
    status: completed
  - id: suggested-actions
    content: Add IBKR Sync button to suggested-actions.tsx
    status: completed
isProject: false
---

# Plaid Investments Integration

## Dashboard Configuration (Manual Steps)

In Plaid Dashboard, configure:

**Redirect URIs:**

```
https://*.vercel.app/api/plaid/callback
http://localhost:3000/api/plaid/callback
```

**Webhook URL:**

```
https://your-app.vercel.app/api/plaid/webhook
```

## Environment Variables

Add to `.env.example` and your actual `.env`:

```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_production_secret
PLAID_ENV=sandbox  # or production
```

## Implementation Architecture

```mermaid
sequenceDiagram
    participant User
    participant UI as PlaidLinkDialog
    participant API as NextAPI
    participant Plaid as PlaidAPI
    participant DB as Database
    
    User->>UI: Click "Connect Brokerage"
    UI->>API: POST /api/plaid/link-token
    API->>Plaid: Create link token
    Plaid-->>API: link_token
    API-->>UI: link_token
    UI->>Plaid: Open Plaid Link
    User->>Plaid: Select bank, authenticate
    Plaid-->>UI: public_token
    UI->>API: POST /api/plaid/exchange
    API->>Plaid: Exchange for access_token
    Plaid-->>API: access_token
    API->>DB: Store encrypted token
    API-->>UI: Success
```

## Files to Create

Following the Robinhood pattern in [lib/robinhood/](lib/robinhood/):

1. **`lib/plaid/client.ts`** - Plaid SDK wrapper

   - `createLinkToken()` - Generate Link token for UI
   - `exchangePublicToken()` - Exchange public token for access token
   - `getInvestmentHoldings()` - Fetch holdings
   - `getInvestmentTransactions()` - Fetch transactions
   - `getAccounts()` - List connected accounts

2. **`lib/plaid/types.ts`** - TypeScript interfaces

   - `PlaidSession`, `PlaidHolding`, `PlaidSecurity`, `FormattedPortfolio`

3. **API Routes:**

   - `app/(chat)/api/plaid/route.ts` - Connection status, disconnect
   - `app/(chat)/api/plaid/link-token/route.ts` - Generate Link token
   - `app/(chat)/api/plaid/exchange/route.ts` - Exchange tokens
   - `app/(chat)/api/plaid/webhook/route.ts` - Handle Plaid webhooks
   - `app/(chat)/api/plaid/holdings/route.ts` - Get holdings

4. **`components/plaid-link-dialog.tsx`** - UI component using `react-plaid-link`

5. **Database Schema** - Add to [lib/db/schema.ts](lib/db/schema.ts):
   ```typescript
   export const plaidItem = pgTable("plaid_item", {
     id: uuid().primaryKey().defaultRandom(),
     userId: uuid().notNull().references(() => user.id),
     accessToken: text().notNull(),
     itemId: text().notNull(),
     institutionId: text(),
     institutionName: text(),
     createdAt: timestamp().defaultNow(),
   });
   ```

6. **AI Tools** - Add to [lib/ai/tools/](lib/ai/tools/):

   - `plaidConnect` - Trigger Plaid Link
   - `plaidGetHoldings` - Get investment holdings
   - `plaidGetTransactions` - Get investment transactions

## Dependencies

```bash
pnpm add plaid react-plaid-link
```

## Key Differences from Robinhood

| Aspect | Robinhood | Plaid |

|--------|-----------|-------|

| Auth | Direct credentials + MFA | OAuth via Plaid Link |

| Session | Access/refresh tokens | Access token (long-lived) |

| Multi-broker | No | Yes (IBKR, Schwab, Fidelity, etc.) |

| Data updates | On-demand | Webhooks + on-demand |

## Supported Brokerages via Plaid Investments

- Interactive Brokers (IBKR)
- Charles Schwab
- Fidelity
- TD Ameritrade
- E*TRADE
- Vanguard
- And 100+ more