const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = "ixerygypaevxzmiknokg";
const headers = { Authorization: `Bearer ${token}` };

async function probe(label, url, opts = {}) {
  try {
    const res = await fetch(url, { headers, ...opts });
    const text = await res.text();
    console.log(`--- ${label} ---`);
    console.log(`status: ${res.status} ${res.statusText}`);
    console.log(`body: ${text.slice(0, 1500)}`);
  } catch (e) {
    console.log(`--- ${label} ---`);
    console.log(`error: ${e.message}`);
  }
}

// No management token needed for these — just checks whether the project's
// own data-plane hostname resolves and answers at all.
await probe("project REST gateway (no auth)", `https://${ref}.supabase.co/rest/v1/`, { headers: {} });
await probe("project auth health (no auth)", `https://${ref}.supabase.co/auth/v1/health`, { headers: {} });
