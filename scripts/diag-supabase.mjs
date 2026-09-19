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

await probe("list all projects", "https://api.supabase.com/v1/projects");
await probe("get project", `https://api.supabase.com/v1/projects/${ref}`);
await probe("v1 config/auth", `https://api.supabase.com/v1/projects/${ref}/config/auth`);
await probe("v2 project config", `https://api.supabase.com/v2/projects/${ref}/config`);
