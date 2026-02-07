import process from "node:process"

const API_BASE_URL = process.env.API_BASE_URL || "https://zeruva-backend-production.up.railway.app/api"
const WALLET = process.env.WALLET
const SLOT_INDEX = Number(process.env.SLOT_INDEX ?? 0)
const ALIEN_DB_ID = process.env.ALIEN_DB_ID ? Number(process.env.ALIEN_DB_ID) : null

if (!WALLET) {
  console.error("Missing WALLET env var")
  process.exit(1)
}

if (Number.isNaN(SLOT_INDEX)) {
  console.error("SLOT_INDEX must be a number")
  process.exit(1)
}

if (ALIEN_DB_ID !== null && Number.isNaN(ALIEN_DB_ID)) {
  console.error("ALIEN_DB_ID must be a number")
  process.exit(1)
}

async function fetchJson(path, options) {
  const url = `${API_BASE_URL}${path}`
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`)
  }

  return json
}

function logStep(title, payload) {
  console.log(`\n=== ${title} ===`)
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2))
  }
}

async function main() {
  logStep("Rewards (before)")
  const before = await fetchJson(`/rewards/${WALLET}`)
  logStep("/rewards response", before)

  if (ALIEN_DB_ID !== null) {
    logStep("Assign slot")
    await fetchJson(`/assign-slot`, {
      method: "POST",
      body: JSON.stringify({ wallet: WALLET, slotIndex: SLOT_INDEX, alienDbId: ALIEN_DB_ID }),
    })

    const afterAssign = await fetchJson(`/rewards/${WALLET}`)
    logStep("Rewards (after assign)", afterAssign)

    logStep("Unassign slot")
    await fetchJson(`/unassign-slot`, {
      method: "POST",
      body: JSON.stringify({ wallet: WALLET, alienDbId: ALIEN_DB_ID }),
    })

    const afterUnassign = await fetchJson(`/rewards/${WALLET}`)
    logStep("Rewards (after unassign)", afterUnassign)
  } else {
    console.log("ALIEN_DB_ID not provided; skipping assign/unassign.")
  }
}

main().catch((err) => {
  console.error("Diagnostics failed:", err)
  process.exit(1)
})
