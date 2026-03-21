/**
 * Clash Domain-Set / IP-Set -> QuantumultX filter 批量转换
 * 编辑下方 RULES 列表，添加需要转换的规则
 */

const https = require("https");
const fs    = require("fs");
const path  = require("path");

// ─── 在这里配置需要转换的规则 ────────────────────────────────────────
const RULES = [
  {
    // 输出文件名（保存到 output/ 目录）
    name:   "category-finance-domain.list",
    // 源 yaml 地址
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-finance.yaml",
    // 策略名
    policy: "DIRECT",
  },
  {
    name:   "spotify-domain.list",
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/spotify.yaml",
    policy: "DIRECT",
  },
  {
    name:   "category-entertainment-domain.list",
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-entertainment.yaml",
    policy: "DIRECT",
  },
  {
    name:   "tiktok-domain.list",
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.yaml",
    policy: "DIRECT",
  },
  {
    name:   "telegram-domain.list",
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.yaml",
    policy: "DIRECT",
  },
  {
    name:   "category-voip-domain.list",
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-voip.yaml",
    policy: "DIRECT",
  },
  {
    name:   "google-domain.list",
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.yaml",
    policy: "DIRECT",
  },
  {
    name:   "apple-domain.list",
    url:    "https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple.yaml",
    policy: "DIRECT",
  },
  {
    name:   "category-ads-all-domain.list",
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ads-all.yaml",
    policy: "DIRECT",
  },
  {
    name:   "private-domain.list",
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.yaml",
    policy: "DIRECT",
  },
  {
    name:   "telegram-ip.list",
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.yaml",
    policy: "DIRECT",
  },
  {
    name:   "category-ai-!cn-domain.list",
    url:    "https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-!cn.yaml",
    policy: "DIRECT",
  },
  {
    name:   "private-ip.list",
    url:    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/private.yaml",
    policy: "DIRECT",
  }
];
// ─────────────────────────────────────────────────────────────────────

function fetch(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, { headers: { "User-Agent": "clash" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location);
        }
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve(data));
      }).on("error", reject);
    };
    get(url);
  });
}

function isComment(line) {
  const t = line.trim();
  return !t || t[0] === "#" || t.startsWith("//") || t[0] === ";";
}

function cleanLine(line) {
  line = line.trim();
  if (line[0] === "-") line = line.slice(1).trim();
  const ci = line.indexOf(" #");
  if (ci !== -1) line = line.slice(0, ci).trim();
  const ci2 = line.indexOf(" //");
  if (ci2 !== -1) line = line.slice(0, ci2).trim();
  if ((line[0] === '"' && line.endsWith('"')) ||
      (line[0] === "'" && line.endsWith("'"))) {
    line = line.slice(1, -1);
  }
  return line.trim();
}

function isCIDR(s) {
  const sl = s.lastIndexOf("/");
  return sl !== -1 && !isNaN(parseInt(s.slice(sl + 1), 10));
}

function detectFormat(lines) {
  let n = 0;
  for (const line of lines) {
    if (isComment(line)) continue;
    const r = cleanLine(line);
    if (!r || /^payload\s*:/i.test(r)) continue;
    if (isCIDR(r)) return "ip";
    if (++n >= 10) break;
  }
  return "domain";
}

function convert(content, policy) {
  const lines  = content.split("\n");
  const fmt    = detectFormat(lines);
  const result = [];

  for (const line of lines) {
    if (isComment(line)) continue;
    const raw = cleanLine(line);
    if (!raw || /^payload\s*:/i.test(raw)) continue;

    let rule = null;
    if (fmt === "ip") {
      if (isCIDR(raw)) {
        rule = (raw.includes(":") ? "ip-cidr6" : "ip-cidr") + ", " + raw + ", " + policy + ", no-resolve";
      }
    } else {
      if (raw.startsWith("+.")) {
        const d = raw.slice(2);
        if (d) rule = "host-suffix, " + d + ", " + policy;
      } else if (!raw.includes(",") && !raw.includes(" ")) {
        rule = "host, " + raw + ", " + policy;
      }
    }
    if (rule) result.push(rule);
  }
  return result;
}

async function main() {
  fs.mkdirSync("output", { recursive: true });

  for (const rule of RULES) {
    console.log(`Converting: ${rule.name} ...`);
    try {
      const content = await fetch(rule.url);
      const lines   = convert(content, rule.policy);
      const header  = [
        `# Generated from: ${rule.url}`,
        `# Policy: ${rule.policy}`,
        `# Updated: ${new Date().toISOString()}`,
        `# Total: ${lines.length} rules`,
        "",
      ].join("\n");
      fs.writeFileSync(path.join("output", rule.name), header + lines.join("\n") + "\n");
      console.log(`  → ${lines.length} rules written to output/${rule.name}`);
    } catch (e) {
      console.error(`  ✗ Failed: ${e.message}`);
      process.exit(1);
    }
  }
}

main();
