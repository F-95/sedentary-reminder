import type { StatsDimension, WindowTotals } from "@/utils/statsBuckets";

/** 中文注释：情绪简报维度展示名（用于模板占位）。 */
function dimensionPhrase(dimension: StatsDimension): string {
  if (dimension === "day") {
    return "今日";
  }
  if (dimension === "week") {
    return "近7日";
  }
  if (dimension === "month") {
    return "本月";
  }
  return "本年";
}

function fill(
  template: string,
  dim: string,
  totals: WindowTotals,
  peakLabel: string | null
): string {
  const peak = peakLabel ?? "—";
  return template
    .split("{DIM}")
    .join(dim)
    .split("{T}")
    .join(String(totals.sedentaryTriggered))
    .split("{H}")
    .join(String(totals.hydrationNotified))
    .split("{P}")
    .join(String(totals.proactiveActivity))
    .split("{S}")
    .join(String(totals.skips))
    .split("{A}")
    .join(String(totals.activityMerged))
    .split("{PEAK}")
    .join(peak);
}

type TemplateFn = (dim: string, totals: WindowTotals, peakLabel: string | null) => string;

/** 中文注释：内置多组情绪价值模板（随机抽取一条），无外部 LLM。 */
const TEMPLATES: TemplateFn[] = [
  (dim, t, peak) =>
    fill(
      "{DIM}里你完成了 {A} 次活动记录，其中主动在枢纽点「记录活动」{P} 次——这份自律本身就值得被看见。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "久坐提醒触发了 {T} 次，你在节奏里回应了 {A} 次活动；{DIM}的你，正在把健康一点点捡回来。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "补水提醒 {H} 次，像给身体的小情书；配合 {A} 次起身活动，{DIM}的状态会更稳、更轻。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "跳过 {S} 次并不代表松懈，有时是会议卡死、有时是脑子过载；{DIM}能诚实记录，就已经很勇敢。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "{DIM}活动峰值出现在「{PEAK}」附近——抓住那个时段多动一动，复利会悄悄发生。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "主动记录活动 {P} 次，说明你在主动接管身体叙事；{DIM}的认可，先给自己一句「做得不错」。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "久坐完成与主动记录合计 {A} 次，跳过 {S} 次；比例没有标准答案，只有更适合你当下节奏的答案。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "{DIM}补水 {H} 次：若还能再多一两杯，大脑供血和情绪底色都会更友好。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "提醒来了 {T} 次，你用活动或记录回应了 {A} 次——回应率本身就是进步曲线，不必一次到位。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "当跳过达到 {S} 次时，不妨把下一次提醒当成「微重启」：站起来 30 秒也算赢。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "{DIM}你在枢纽主动留下 {P} 条活动痕迹，这是比任何 KPI 都温柔的正向反馈。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "数据只是镜子：{A} 次活动、{S} 次跳过、{H} 次补水——照见的是你在忙碌里仍愿意照顾自己。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "若「{PEAK}」时段活动偏多，试着把最难的专注任务拆开，给身体留一点呼吸缝。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "{DIM}合计 {T} 次久坐提醒：每一次响铃，都是应用在和你说「我还在乎你」。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "主动活动 {P} 次 + 完成提醒内活动计入合并 {A} 次——你在用可量化的方式，兑换更久的专注力。",
      dim,
      t,
      peak
    ),
  (dim, t, peak) =>
    fill(
      "跳过 {S} 次后仍能回到节奏，这种韧性比完美 streak 更真实；{DIM}继续温和推进就好。",
      dim,
      t,
      peak
    )
];

/**
 * 中文注释：根据当前维度与窗口合计生成一条随机情绪简报（纯本地模板）。
 * @param peakBucketLabel 活动合并次数最多的桶标签，无可传 null
 */
export function buildEmotionalStatsBrief(
  dimension: StatsDimension,
  totals: WindowTotals,
  peakBucketLabel: string | null
): string {
  const dim = dimensionPhrase(dimension);
  const idx = Math.floor(Math.random() * TEMPLATES.length);
  const fn = TEMPLATES[idx];
  if (!fn) {
    return `${dim}暂无可用模板，数据已在图表中汇总。`;
  }
  return fn(dim, totals, peakBucketLabel);
}
