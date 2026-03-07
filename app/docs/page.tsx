"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const sections = [
  { id: "overview", title: "Overview", titleZh: "概述" },
  { id: "architecture", title: "Architecture", titleZh: "架构" },
  { id: "metrics", title: "Metrics Reference", titleZh: "指标参考" },
  { id: "grading", title: "Grading Scale", titleZh: "评分标准" },
  { id: "deep-scan", title: "Deep Scan", titleZh: "深度扫描" },
  { id: "concentration", title: "Concentration Analysis", titleZh: "集中度分析" },
  { id: "bundle", title: "Bundle Detection", titleZh: "捆绑检测" },
  { id: "funding", title: "Funding Clusters", titleZh: "资金集群" },
  { id: "api", title: "API Reference", titleZh: "API 参考" },
  { id: "data-sources", title: "Data Sources", titleZh: "数据来源" },
  { id: "limitations", title: "Limitations", titleZh: "局限性" },
];

function CodeBlock({ code, lang = "json" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border)", marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", background: "var(--bg-card-alt)", borderBottom: "1px solid var(--border)" }}>
        <span className="font-mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{lang}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="font-mono" style={{ fontSize: "11px", color: copied ? "var(--accent)" : "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="font-mono" style={{ margin: 0, padding: "16px", fontSize: "12px", lineHeight: 1.6, color: "var(--text-secondary)", overflowX: "auto", background: "var(--bg-card)" }}>
        {code}
      </pre>
    </div>
  );
}

function Endpoint({ method, path, desc, body, response }: { method: string; path: string; desc: string; body?: string; response: string }) {
  return (
    <div className="glass" style={{ borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
        <span className="font-mono" style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: method === "POST" ? "rgba(153,69,255,0.12)" : "rgba(20,241,149,0.12)", color: method === "POST" ? "var(--accent)" : "var(--green)" }}>{method}</span>
        <code className="font-mono" style={{ fontSize: "13px", color: "var(--text)" }}>{path}</code>
      </div>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>{desc}</p>
      {body && (<><div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Request Body</div><CodeBlock code={body} /></>)}
      <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Response</div>
      <CodeBlock code={response} />
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("holdtech-lang");
    if (savedLang === "zh") setLang("zh");
    const savedTheme = localStorage.getItem("holdtech-theme");
    const isDark = savedTheme === "dark";
    setDarkMode(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActiveSection(entry.target.id);
      }
    }, { rootMargin: "-20% 0px -60% 0px" });
    sections.forEach(s => { const el = document.getElementById(s.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("holdtech-theme", next ? "dark" : "light");
  };

  const zh = lang === "zh";

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "relative", zIndex: 10, maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>

        {/* Nav */}
        <div className="glass" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderRadius: "16px", marginTop: "16px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
            <img src="/logo.png" alt="HoldTech" width={28} height={28} style={{ objectFit: "contain" }} />
            <span style={{ fontSize: "20px", fontWeight: 800 }}><span style={{ color: "var(--accent)" }}>HOLD</span><span style={{ color: "var(--text-muted)" }}>TECH</span></span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="font-mono" style={{ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px", background: "rgba(153,69,255,0.08)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}>DOCS</span>
            <button onClick={() => { const next = lang === "en" ? "zh" : "en"; setLang(next); localStorage.setItem("holdtech-lang", next); }}
              className="font-mono" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "10px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "12px", fontWeight: 700 }}>
              {zh ? "EN" : "中文"}
            </button>
            <button onClick={toggleTheme} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "10px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "18px" }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </div>

        {/* Layout: sidebar + content */}
        <div style={{ display: "flex", gap: "40px", marginTop: "32px", paddingBottom: "80px" }}>

          {/* Sidebar */}
          <nav style={{ width: "200px", flexShrink: 0, position: "sticky", top: "32px", alignSelf: "flex-start" }}>
            <div className="font-mono" style={{ fontSize: "10px", fontWeight: 600, color: "var(--accent)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "16px" }}>
              {zh ? "文档导航" : "DOCUMENTATION"}
            </div>
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`}
                style={{ display: "block", padding: "6px 12px", fontSize: "13px", color: activeSection === s.id ? "var(--accent)" : "var(--text-muted)", textDecoration: "none", borderLeft: `2px solid ${activeSection === s.id ? "var(--accent)" : "transparent"}`, fontWeight: activeSection === s.id ? 600 : 400, marginBottom: "2px", transition: "all 0.15s" }}>
                {zh ? s.titleZh : s.title}
              </a>
            ))}
          </nav>

          {/* Content */}
          <main style={{ flex: 1, minWidth: 0 }}>

            {/* Overview */}
            <section id="overview" style={{ marginBottom: "48px" }}>
              <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", marginBottom: "16px" }}>
                {zh ? "HoldTech 技术文档" : "HoldTech Technical Documentation"}
              </h1>
              <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: "16px" }}>
                {zh
                  ? "HoldTech 是一个 Solana 代币持币结构分析工具。它逐个分析每个持有者钱包，计算质量指标，检测庄家模式，并生成 AI 评估报告。本文档涵盖了架构、指标定义、评分方法和 API 参考。"
                  : "HoldTech is a Solana token holderbase quality analysis tool. It profiles individual holder wallets, computes quality metrics, detects manipulation patterns, and generates AI-powered verdicts. This documentation covers the architecture, metric definitions, scoring methodology, and API reference."}
              </p>
              <div className="glass" style={{ borderRadius: "14px", padding: "20px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                {[
                  { value: "100", label: zh ? "钱包分析上限" : "Max wallets analyzed" },
                  { value: "8", label: zh ? "核心指标" : "Core metrics" },
                  { value: "A–F", label: zh ? "评级范围" : "Grade range" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div className="font-mono" style={{ fontSize: "24px", fontWeight: 800, color: "var(--accent)" }}>{s.value}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Architecture */}
            <section id="architecture" style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>{zh ? "系统架构" : "System Architecture"}</h2>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: "16px" }}>
                {zh ? "分析管道分四个阶段运行，每个阶段作为独立的 API 端点：" : "The analysis pipeline runs in four stages, each as an independent API endpoint:"}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {[
                  { stage: "1", name: zh ? "代币信息" : "Token Info", path: "/api/token-info", desc: zh ? "从 Pump.fun + DexScreener 获取元数据、价格、流动性" : "Fetches metadata, price, liquidity from Pump.fun + DexScreener" },
                  { stage: "2", name: zh ? "持有者分析" : "Holder Analysis", path: "/api/analyze", desc: zh ? "获取前 N 名持有者，逐个分析钱包，计算指标" : "Fetches top N holders, profiles each wallet, computes metrics" },
                  { stage: "3", name: zh ? "持有者计数" : "Holder Count", path: "/api/holder-count", desc: zh ? "通过二分搜索分页精确计算非零余额持有者" : "Binary search pagination to count non-zero balance holders accurately" },
                  { stage: "4", name: zh ? "深度扫描" : "Deep Scan", path: "/api/deep-scan", desc: zh ? "捆绑检测、资金集群追踪、买入时间线、集中度分析" : "Bundle detection, funding cluster tracing, buy timeline, concentration analysis" },
                  { stage: "5", name: zh ? "AI 评估" : "AI Verdict", path: "/api/ai-verdict", desc: zh ? "将指标传入 LLM 生成评分、等级和文字评估" : "Passes metrics to LLM for score, grade, and written assessment" },
                ].map(s => (
                  <div key={s.stage} className="glass-alt" style={{ borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "14px" }}>
                    <span className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", minWidth: "18px" }}>{s.stage}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{s.name}</span>
                        <code className="font-mono" style={{ fontSize: "11px", color: "var(--accent)", background: "rgba(153,69,255,0.06)", padding: "1px 6px", borderRadius: "4px" }}>{s.path}</code>
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.7 }}>
                {zh
                  ? "阶段 1-3 并行运行。阶段 4（深度扫描）在阶段 2 完成后运行。阶段 5（AI 评估）在阶段 3（持有者计数）完成后运行，以确保评估中使用准确的持有者数量。"
                  : "Stages 1–3 run in parallel. Stage 4 (deep scan) runs after stage 2 completes. Stage 5 (AI verdict) runs after stage 3 (holder count) completes to ensure accurate holder count in the verdict."}
              </p>
            </section>

            {/* Metrics Reference */}
            <section id="metrics" style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>{zh ? "指标参考" : "Metrics Reference"}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { name: zh ? "新钱包比例" : "Fresh Wallet %", key: "freshWalletPct", desc: zh ? "钱包创建时间不到 7 天的持有者比例。高比例表明可能是为买入此代币而创建的一次性钱包。" : "Percentage of holders whose wallets are less than 7 days old. High values suggest wallets created specifically to buy this token.", warn: "> 40%", formula: "count(walletAge < 7d) / totalAnalyzed × 100" },
                  { name: zh ? "极新钱包比例" : "Very Fresh Wallet %", key: "veryFreshWalletPct", desc: zh ? "钱包创建时间不到 24 小时的持有者比例。极高风险信号。" : "Wallets less than 24 hours old. Extreme risk signal.", warn: "> 20%", formula: "count(walletAge < 1d) / totalAnalyzed × 100" },
                  { name: zh ? "老持有者比例" : "Veteran Holder %", key: "veteranHolderPct", desc: zh ? "钱包年龄超过 90 天的持有者比例。表明有经验的交易者持有。" : "Wallets older than 90 days. Indicates experienced traders holding.", warn: null, formula: "count(walletAge > 90d) / totalAnalyzed × 100" },
                  { name: zh ? "元老持有者比例" : "OG Holder %", key: "ogHolderPct", desc: zh ? "钱包年龄超过 180 天的持有者比例。" : "Wallets older than 180 days.", warn: null, formula: "count(walletAge > 180d) / totalAnalyzed × 100" },
                  { name: zh ? "低活跃度比例" : "Low Activity %", key: "lowActivityPct", desc: zh ? "总交易数少于 10 笔的钱包比例。低活跃度通常表明是一次性钱包。" : "Wallets with fewer than 10 lifetime transactions. Low activity typically indicates burner wallets.", warn: "> 40%", formula: "count(txCount < 10) / totalAnalyzed × 100" },
                  { name: zh ? "单币持有者比例" : "Single-Token Holder %", key: "singleTokenPct", desc: zh ? "只持有此代币（或此代币+1个其他代币）的钱包比例。高比例表明是人为制造的持币结构。" : "Wallets holding only this token (or this + 1 other). High values suggest manufactured holderbases.", warn: "> 30%", formula: "count(otherTokenCount ≤ 1) / totalAnalyzed × 100" },
                  { name: zh ? "钻石手比例" : "Diamond Hands %", key: "diamondHandsPct", desc: zh ? "持有超过 2 天的钱包比例。表明持有者有较强的信念。" : "Wallets holding for more than 2 days. Indicates conviction.", warn: null, formula: "count(holdDuration > 2d) / totalAnalyzed × 100" },
                  { name: zh ? "平均 SOL 余额" : "Avg SOL Balance", key: "avgSolBalance", desc: zh ? "持有者钱包的平均 SOL 余额。低余额表明是资金不足的一次性钱包。" : "Average SOL balance across holder wallets. Low balances indicate underfunded burner wallets.", warn: "< 0.5 SOL", formula: "sum(solBalance) / totalAnalyzed" },
                ].map(m => (
                  <div key={m.key} className="glass" style={{ borderRadius: "14px", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{m.name}</span>
                      <code className="font-mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.key}</code>
                      {m.warn && <span className="font-mono" style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(239,68,68,0.1)", color: "var(--red)" }}>⚠ {m.warn}</span>}
                    </div>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "8px" }}>{m.desc}</p>
                    <div className="font-mono" style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-card-alt)", padding: "6px 10px", borderRadius: "6px", display: "inline-block" }}>
                      {m.formula}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Grading Scale */}
            <section id="grading" style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>{zh ? "评分标准" : "Grading Scale"}</h2>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: "16px" }}>
                {zh
                  ? "AI 评估生成 0-100 的数字分数和 A-F 的字母等级。评分基于所有指标的综合分析，不是简单加权。"
                  : "The AI verdict generates a numerical score (0–100) and a letter grade (A–F). Scoring is based on holistic analysis of all metrics, not simple weighting."}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
                {[
                  { grade: "A", range: "80–100", color: "#10b981", desc: zh ? "优质持币结构。老钱包、高活跃度、低集中度。" : "Excellent holderbase. Aged wallets, high activity, low concentration." },
                  { grade: "B", range: "65–79", color: "#8b5cf6", desc: zh ? "良好持币结构。一些新钱包但整体健康。" : "Good holderbase. Some fresh wallets but generally healthy." },
                  { grade: "C", range: "50–64", color: "#f59e0b", desc: zh ? "一般。混合信号，需要进一步调查。" : "Average. Mixed signals, warrants further investigation." },
                  { grade: "D", range: "35–49", color: "#f97316", desc: zh ? "较差。多项危险信号，高操控风险。" : "Poor. Multiple red flags, high manipulation risk." },
                  { grade: "F", range: "0–34", color: "#ef4444", desc: zh ? "极差。持币结构很可能是人为制造的。" : "Failing. Holderbase is likely manufactured." },
                ].map(g => (
                  <div key={g.grade} className="glass" style={{ borderRadius: "14px", padding: "16px", textAlign: "center" }}>
                    <div style={{ fontSize: "32px", fontWeight: 900, color: g.color, marginBottom: "4px" }}>{g.grade}</div>
                    <div className="font-mono" style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>{g.range}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{g.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Deep Scan */}
            <section id="deep-scan" style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>{zh ? "深度扫描" : "Deep Scan"}</h2>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: "16px" }}>
                {zh
                  ? "深度扫描在基础分析之后运行，提供更深层次的链上情报。它分析代币的交易历史（最多300笔）并对持有者钱包进行资金来源追踪。"
                  : "The deep scan runs after the base analysis, providing deeper on-chain intelligence. It analyzes the token's transaction history (up to 300 transactions) and traces funding sources for holder wallets."}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {[
                  { title: zh ? "捆绑检测" : "Bundle Detection", desc: zh ? "在同一个 slot（~400ms）内发生的 3+ 笔独立钱包买入被标记为潜在捆绑交易。" : "3+ unique wallet buys in the same slot (~400ms) are flagged as potential bundle transactions." },
                  { title: zh ? "资金集群" : "Funding Clusters", desc: zh ? "追踪每个持有者钱包的前5笔交易，寻找 SOL 来源。同一来源资助 2+ 个钱包即标记为集群。" : "Traces the first 5 transactions of each holder wallet looking for SOL funding source. Same source funding 2+ wallets = cluster." },
                  { title: zh ? "买入时间线" : "Buy Timeline", desc: zh ? "绘制每个持有者首次买入的时间。首笔交易后 5 分钟内的买入标记为内部人员风险。" : "Maps when each holder first bought. Buys within 5 minutes of the first transaction are flagged as insider risk." },
                  { title: zh ? "集中度指标" : "Concentration Metrics", desc: zh ? "计算 Top 5/10/20 持有比例、基尼系数和 HHI 指数，排除流动性池。" : "Computes Top 5/10/20 holder percentages, Gini coefficient, and Herfindahl-Hirschman Index, excluding liquidity pools." },
                ].map(c => (
                  <div key={c.title} className="glass-alt" style={{ borderRadius: "14px", padding: "16px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>{c.title}</div>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{c.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Concentration */}
            <section id="concentration" style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>{zh ? "集中度分析" : "Concentration Analysis"}</h2>
              <div className="glass" style={{ borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "12px" }}>{zh ? "基尼系数" : "Gini Coefficient"}</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "12px" }}>
                  {zh
                    ? "衡量持币分配的不平等程度。0 = 完全平均分配，1 = 一个钱包持有全部。用于检测鲸鱼主导的代币。"
                    : "Measures inequality of token distribution across holders. 0 = perfectly equal distribution, 1 = one wallet holds everything. Used to detect whale-dominated tokens."}
                </p>
                <CodeBlock code={`Gini = Σ|xi - xj| / (2 * n * Σxi)

Where:
  xi, xj = individual holder balances
  n = number of holders analyzed

Interpretation:
  < 0.6  → Well distributed
  0.6-0.8 → Moderately concentrated  
  > 0.8  → Highly concentrated ⚠️`} lang="math" />
              </div>
              <div className="glass" style={{ borderRadius: "14px", padding: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "12px" }}>{zh ? "赫芬达尔-赫希曼指数 (HHI)" : "Herfindahl-Hirschman Index (HHI)"}</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "12px" }}>
                  {zh
                    ? "市场集中度的标准度量。对每个持有者的市场份额进行平方求和。对大持有者更敏感。"
                    : "Standard measure of market concentration. Sum of squared market shares for each holder. More sensitive to large holders than Gini."}
                </p>
                <CodeBlock code={`HHI = Σ(si)²

Where:
  si = holder i's balance / total supply

Interpretation:
  < 0.01   → Highly competitive (diversified)
  0.01-0.15 → Moderate concentration
  0.15-0.25 → High concentration
  > 0.25   → Very high concentration ⚠️`} lang="math" />
              </div>
            </section>

            {/* Bundle Detection */}
            <section id="bundle" style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>{zh ? "捆绑检测" : "Bundle Detection"}</h2>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: "16px" }}>
                {zh
                  ? "捆绑交易是指多个钱包在同一个 Solana slot（约400毫秒）内买入同一代币。这通常表明一个实体使用 Jito 捆绑包或类似工具协调多钱包买入，以制造虚假的持有者增长。"
                  : "Bundle transactions occur when multiple wallets buy the same token in the same Solana slot (~400ms). This typically indicates a single entity coordinating multi-wallet buys using Jito bundles or similar tools to manufacture fake holder growth."}
              </p>
              <CodeBlock code={`Detection algorithm:
1. Fetch token's transaction history (3 pages × 100 = 300 txs)
2. Group transactions by slot number
3. Extract fee_payer as the buying wallet
4. Flag slots with 3+ unique wallets as potential bundles
5. Sort by wallet count descending, return top 10

Thresholds:
  3-4 wallets/slot → Possible bundle
  5-9 wallets/slot → Likely bundle  
  10+ wallets/slot → Confirmed bundle ⚠️`} lang="text" />
            </section>

            {/* Funding Clusters */}
            <section id="funding" style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>{zh ? "资金集群追踪" : "Funding Cluster Tracing"}</h2>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: "16px" }}>
                {zh
                  ? "资金集群分析追踪每个持有者钱包的 SOL 来源。如果多个持有者钱包由同一个钱包资助，这强烈暗示它们由同一实体控制。"
                  : "Funding cluster analysis traces the SOL funding source for each holder wallet. If multiple holder wallets were funded by the same wallet, this strongly suggests they're controlled by the same entity."}
              </p>
              <CodeBlock code={`Tracing algorithm:
1. For each holder wallet, fetch 20 most recent signatures
2. Sort by blockTime ascending (oldest first)
3. Check first 5 transactions for incoming SOL > 0.01
4. The fee_payer of the funding transaction = funding source
5. Group holders by common funding source
6. Flag groups of 2+ as clusters, 3+ as RED FLAG

Limitations:
- Only traces 1 hop back (direct funding)
- Only checks top 10 non-pool wallets (rate limit constraint)
- CEX withdrawals may create false clusters`} lang="text" />
            </section>

            {/* API Reference */}
            <section id="api" style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>{zh ? "API 参考" : "API Reference"}</h2>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: "24px" }}>
                {zh ? "所有端点接受 POST 请求，Content-Type 为 application/json。" : "All endpoints accept POST requests with Content-Type: application/json."}
              </p>

              <Endpoint method="POST" path="/api/analyze"
                desc={zh ? "分析代币持有者钱包。返回指标、分布和持有者详情。" : "Analyze token holder wallets. Returns metrics, distributions, and holder details."}
                body={`{
  "mint": "TokenMintAddress...",
  "limit": 20  // 20, 50, or 100
}`}
                response={`{
  "mint": "...",
  "tokenName": "Example",
  "tokenSymbol": "EX",
  "totalHolders": 20,
  "analyzedHolders": 20,
  "totalSupply": 1000000000,
  "metrics": {
    "freshWalletPct": 35.0,
    "veryFreshWalletPct": 10.0,
    "veteranHolderPct": 25.0,
    "ogHolderPct": 15.0,
    "lowActivityPct": 40.0,
    "singleTokenPct": 20.0,
    "diamondHandsPct": 60.0,
    "avgWalletAgeDays": 45.2,
    "medianWalletAgeDays": 30.1,
    "avgTxCount": 156,
    "avgSolBalance": 2.5
  },
  "distribution": { ... },
  "topHolders": [ ... ],
  "wallets": [ ... ]
}`} />

              <Endpoint method="POST" path="/api/deep-scan"
                desc={zh ? "运行深度链上分析：捆绑检测、资金追踪、集中度。" : "Run deep on-chain analysis: bundle detection, funding tracing, concentration."}
                body={`{
  "mint": "TokenMintAddress...",
  "wallets": [ ... ],  // from /api/analyze
  "totalSupply": 1000000000
}`}
                response={`{
  "txHistoryCount": 300,
  "bundles": [{ "slot": 12345, "wallets": [...], "txCount": 5 }],
  "bundleCount": 2,
  "bundledWalletCount": 8,
  "concentration": {
    "top5Pct": 15.2,
    "top10Pct": 28.4,
    "top20Pct": 45.1,
    "giniCoefficient": 0.72,
    "herfindahlIndex": 0.035
  },
  "fundingClusters": [{ "funder": "...", "wallets": [...], "count": 3 }],
  "buyTimeline": [{ "wallet": "...", "minutesAfterFirst": 2.5 }],
  "solDistribution": { "dust": 20, "low": 30, "medium": 35, "high": 10, "whale": 5 }
}`} />

              <Endpoint method="POST" path="/api/holder-count"
                desc={zh ? "通过二分搜索分页精确计算非零余额持有者数量。" : "Accurately count non-zero balance holders via binary search pagination."}
                body={`{
  "mint": "TokenMintAddress..."
}`}
                response={`{
  "holderCount": 10828
}`} />

              <Endpoint method="POST" path="/api/ai-verdict"
                desc={zh ? "根据指标生成 AI 评估报告。" : "Generate AI verdict from metrics."}
                body={`{
  "metrics": { ... },
  "totalHolders": 10828,
  "analyzedHolders": 20,
  "tokenSymbol": "EX"
}`}
                response={`{
  "score": 72,
  "grade": "B",
  "verdict": "This holderbase shows moderate quality...",
  "flags": [
    "⚠️ 35% fresh wallets — elevated sybil risk",
    "✅ Strong veteran presence at 25%"
  ]
}`} />

              <Endpoint method="POST" path="/api/token-info"
                desc={zh ? "获取代币元数据、价格和市场数据。" : "Fetch token metadata, price, and market data."}
                body={`{
  "mint": "TokenMintAddress..."
}`}
                response={`{
  "name": "Example",
  "symbol": "EX",
  "image": "https://...",
  "price": 0.00123,
  "mcap": 1234567,
  "volume24h": 56789,
  "liquidity": 98765,
  "holderCount": null,
  "sparkline": [0.001, 0.0012, ...]
}`} />
            </section>

            {/* Data Sources */}
            <section id="data-sources" style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>{zh ? "数据来源" : "Data Sources"}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { source: "Helius RPC", usage: zh ? "持有者获取 (getTokenLargestAccounts, getTokenAccounts)、钱包分析 (getSignaturesForAddress, getTransaction)、增强交易历史" : "Holder fetching (getTokenLargestAccounts, getTokenAccounts), wallet profiling (getSignaturesForAddress, getTransaction), enhanced transaction history", limit: zh ? "免费层级速率限制" : "Free tier rate limits" },
                  { source: "DexScreener", usage: zh ? "代币价格、市值、流动性、24小时交易量、价格变化" : "Token price, market cap, liquidity, 24h volume, price changes", limit: "30 req/batch, adaptive backoff" },
                  { source: "Pump.fun", usage: zh ? "代币元数据（名称、图片、描述）、社交链接" : "Token metadata (name, image, description), social links", limit: zh ? "未记录的公共 API" : "Undocumented public API" },
                  { source: "GeckoTerminal", usage: zh ? "K线数据用于迷你价格走势图" : "OHLCV candle data for sparkline charts", limit: "30 req/min" },
                  { source: "OpenAI", usage: zh ? "GPT-4o-mini 生成文字评估" : "GPT-4o-mini for verdict text generation", limit: zh ? "按使用量计费" : "Pay per usage" },
                ].map(d => (
                  <div key={d.source} className="glass-alt" style={{ borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "16px" }}>
                    <span className="font-mono" style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent)", minWidth: "120px" }}>{d.source}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", flex: 1 }}>{d.usage}</span>
                    <span className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}>{d.limit}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Limitations */}
            <section id="limitations" style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>{zh ? "局限性" : "Limitations"}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  zh ? "仅分析前 20/50/100 名持有者——小持有者未包含在指标中" : "Only analyzes top 20/50/100 holders — small holders are not included in metrics",
                  zh ? "钱包年龄基于首笔链上交易，不是钱包创建时间" : "Wallet age is based on first on-chain transaction, not wallet creation time",
                  zh ? "资金追踪仅回溯 1 跳——多层混淆无法检测" : "Funding tracing only goes 1 hop back — multi-layered obfuscation is not detected",
                  zh ? "交易所提款可能导致资金集群误报" : "CEX withdrawals may create false positive funding clusters",
                  zh ? "捆绑检测需要交易仍在链上历史中（最近 300 笔）" : "Bundle detection requires transactions to still be in on-chain history (recent 300 txs)",
                  zh ? "AI 评估是概率性的——相同指标可能产生略微不同的评分" : "AI verdicts are probabilistic — same metrics may produce slightly different scores",
                  zh ? "池/LP 检测使用已知 AMM 地址列表——新 DEX 可能未被识别" : "Pool/LP detection uses a known AMM address list — new DEXes may not be recognized",
                  zh ? "Helius 免费层级速率限制可能在高使用量时导致分析不完整" : "Helius free tier rate limits may cause incomplete analysis during high usage",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0" }}>
                    <span style={{ color: "var(--yellow)", flexShrink: 0 }}>⚠</span>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
            </section>

          </main>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
              <img src="/logo.png" alt="" width={16} height={16} style={{ objectFit: "contain" }} /> HOLDTECH
            </Link>
          </div>
          <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)" }}>{zh ? "入场前先了解" : "know before you ape"}</div>
        </div>
      </div>
    </div>
  );
}
