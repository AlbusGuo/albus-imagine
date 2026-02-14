/**
 * Mermaid 工具函数
 */

export type MermaidMode = 'timeline' | 'quadrant' | 'flowchart' | 'gantt' | 'sequence' | 'pie' | 'mindmap' | 'sankey';

export interface TimelineItem {
	period: string;
	events: string[];
	section?: string;
}

export interface QuadrantPoint {
	name: string;
	x: number;
	y: number;
}

export interface FlowchartNode {
	id: string;
	label: string;
	shape: string;
	group: string;
	color?: string;
}

export interface FlowchartEdge {
	from: string;
	to: string;
	label?: string;
}

export interface GanttTask {
	name: string;
	startDate: string;
	endDate: string;
	status?: string;
	section?: string;
	isMilestone?: boolean;
}

export interface SequenceParticipant {
	name: string;
	type: string;
}

export interface SequenceMessage {
	from: string;
	to: string;
	text: string;
	arrow: string;
}

export interface PieItem {
	label: string;
	value: number;
}

export interface MindmapNode {
	id: string;
	text: string;
	level: number;
}

export interface SankeyLink {
	source: string;
	target: string;
	value: number;
}

export interface SankeyMap {
	[key: string]: {
		target: string;
		value: number;
	}[];
}

export interface MermaidData {
	items?: TimelineItem[] | PieItem[];
	points?: QuadrantPoint[];
	nodes?: FlowchartNode[];
	edges?: FlowchartEdge[];
	tasks?: GanttTask[];
	participants?: SequenceParticipant[];
	messages?: SequenceMessage[];
	tree?: MindmapNode[];
	links?: SankeyLink[];
	map?: SankeyMap;
	config?: Record<string, any>;
	theme?: string;
}

/**
 * 转义 Mermaid 字符串
 */
export function escapeMermaid(s: string): string {
	return String(s || '').replace(/"/g, '\\"').replace(/\r?\n/g, ' ').trim();
}

/**
 * 生成唯一名称
 */
export function generateUniqueName(existingNames: string[], prefix = '节点'): string {
	// 创建 Set 以提高查找性能
	const nameSet = new Set(existingNames);
	let index = 1;
	while (nameSet.has(`${prefix}${index}`)) index++;
	return `${prefix}${index}`;
}

/**
 * 生成 Mermaid 代码
 */
export function generateMermaidCode(mode: MermaidMode, data: MermaidData): string {
	let code = '';

	switch (mode) {
		case 'timeline': {
			const items = data.items || [];
			const config = data.config || {};
			const theme = data.theme || '';
			
			// 添加主题配置
			if (theme && theme !== 'default') {
				code += `%%{init: { 'theme': '${theme}' }}%%\n`;
			}
			
			code += `timeline\n`;
			if (config.title && config.title.trim()) {
				code += `  title ${escapeMermaid(config.title)}\n`;
			}
			
			// 按分组分组
			const sections = new Map<string, typeof items>();
			const ungrouped: typeof items = [];
			
			items.forEach(item => {
				if (item.section) {
					if (!sections.has(item.section)) {
						sections.set(item.section, []);
					}
					sections.get(item.section)!.push(item);
				} else {
					ungrouped.push(item);
				}
			});
			
			// 添加分组数据
			sections.forEach((sectionItems, sectionName) => {
				code += `  section ${escapeMermaid(sectionName)}\n`;
				sectionItems.forEach(it => {
					const evs = (it.events || [])
						.map(e => e.trim())
						.filter(Boolean)
						.join(' : ');
					if (evs) {
						code += `    ${escapeMermaid(it.period || '时期')} : ${evs}\n`;
					}
				});
			});
			
			// 添加未分组数据
			ungrouped.forEach(it => {
				const evs = (it.events || [])
					.map(e => e.trim())
					.filter(Boolean)
					.join(' : ');
				if (evs) {
					code += `  ${escapeMermaid(it.period || '时期')} : ${evs}\n`;
				}
			});
			break;
		}
		case 'quadrant': {
			const points = data.points || [];
			const config = data.config || {};
			code = `quadrantChart\n  title ${escapeMermaid(config.title || '四象限')}\n`;
			code += `  x-axis "${escapeMermaid(config.xLeft || '低')}" --> "${escapeMermaid(config.xRight || '高')}"\n`;
			code += `  y-axis "${escapeMermaid(config.yDown || '不足')}" --> "${escapeMermaid(config.yUp || '充足')}"\n`;
			points.forEach(p => {
				code += `  "${escapeMermaid(p.name || '点')}": [${p.x || 0.5}, ${p.y || 0.5}]\n`;
			});
			break;
		}
		case 'flowchart': {
			const nodes = data.nodes || [];
			const edges = data.edges || [];
			const config = data.config || {};
			code = `graph ${config.direction || 'TD'}\n`;
			
			// 节点形状映射（与源码保持一致）
			const brackets: Record<string, [string, string]> = {
				rect: ['[', ']'], 
				rounded: ['(', ')'], 
				circle: ['((', '))'], 
				diamond: ['{', '}'], 
				hex: ['{{', '}}'], 
				cylinder: ['[(', ')]'], 
				stadium: ['([', '])'], 
				subroutine: ['[[', ']]'], 
				parallelogram: ['[/', '/]'], 
				'inverse-parallelogram': ['[\\', '\\]'], 
				trapezoid: ['[/', '\\]'], 
				'inverse-trapezoid': ['[\\', '/]'], 
				'double-circle': ['(((', ')))'], 
				asymmetric: ['[>', ']'],
				document: ['[', ']'],
				delay: ['[\\', '/]'],
				database: ['[(', ')]'],
				input: ['[/]', '[/]'],
				output: ['[\\]', '[\\]']
			};
			
			// 新版本的扩展形状语法映射（v11.3.0+）
			const shapeMap: Record<string, string> = {
				// 基本形状的扩展版本
				'rect-ext': 'rect',
				'rounded-ext': 'rounded',
				'circle-ext': 'circle',
				'diamond-ext': 'diamond',
				'hex-ext': 'hex',
				'cyl-ext': 'cyl',
				'stadium-ext': 'stadium',
				'subproc-ext': 'subproc',
				'lean-r-ext': 'lean-r',
				'lean-l-ext': 'lean-l',
				'trap-b-ext': 'trap-b',
				'trap-t-ext': 'trap-t',
				'dbl-circ-ext': 'dbl-circ',
				'doc-ext': 'doc',
				'document': 'doc',
				'delay-ext': 'delay',
				
				// 新增的扩展形状
				'text': 'text',
				'notch-rect': 'notch-rect',
				'lin-rect': 'lin-rect',
				'sm-circ': 'sm-circ',
				'framed-circle': 'framed-circle',
				'fork': 'fork',
				'hourglass': 'hourglass',
				'comment': 'comment',
				'brace-r': 'brace-r',
				'braces': 'braces',
				'bolt': 'bolt',
				'das': 'das',
				'lin-cyl': 'lin-cyl',
				'curv-trap': 'curv-trap',
				'div-rect': 'div-rect',
				'tri': 'tri',
				'win-pane': 'win-pane',
				'f-circ': 'f-circ',
				'lin-doc': 'lin-doc',
				'notch-pent': 'notch-pent',
				'flip-tri': 'flip-tri',
				'sl-rect': 'sl-rect',
				'docs': 'docs',
				'processes': 'processes',
				'flag': 'flag',
				'bow-rect': 'bow-rect',
				'cross-circ': 'cross-circ',
				'tag-doc': 'tag-doc',
				'tag-rect': 'tag-rect'
			};
			
			// 分组处理
			const groups: Record<string, FlowchartNode[]> = {};
			const ungrouped: FlowchartNode[] = [];
			
			nodes.forEach(n => {
				const g = (n.group || '').trim();
				if (g) {
					if (!groups[g]) groups[g] = [];
					groups[g].push(n);
				} else ungrouped.push(n);
			});
			
			// 渲染节点（使用源码的逻辑）
			const renderNode = (n: FlowchartNode, indent: string): string => {
				const shape = n.shape || 'rect';
				if (shapeMap[shape]) {
					// 使用新语法
					return `${indent}${n.id}@{ shape: ${shapeMap[shape]}, label: "${escapeMermaid(n.label || n.id)}" }\n`;
				} else {
					// 回退到旧语法
					const b = brackets[shape] || brackets.rect;
					return `${indent}${n.id}${b[0]}${escapeMermaid(n.label || n.id)}${b[1]}\n`;
				}
			};
			
			// 渲染未分组节点
			ungrouped.forEach(n => {
				code += renderNode(n, '  ');
				if (n.color && n.color !== '#ffffff') code += `  style ${n.id} fill:${n.color}\n`;
			});
			
			// 渲染分组节点
			Object.keys(groups).forEach((g, i) => {
				const sgId = `sg${i}`;
				code += `  subgraph ${sgId}["${escapeMermaid(g)}"]\n`;
				groups[g].forEach(n => code += renderNode(n, '    '));
				code += `  end\n`;
				groups[g].forEach(n => {
					if (n.color && n.color !== '#ffffff') code += `  style ${n.id} fill:${n.color}\n`;
				});
			});
			
			// 渲染边
			edges.forEach(e => {
				if (e.from && e.to) {
					code += `  ${e.from} -->${e.label ? `|${escapeMermaid(e.label)}|` : ''} ${e.to}\n`;
				}
			});
			break;
		}
		case 'gantt': {
			const tasks = data.tasks || [];
			const config = data.config || {};
			const dateFormat = config.dateFormat || 'YYYY-MM-DD';
			const axisFormat = config.axisFormat || '%Y-%m-%d';
			const tickInterval = config.tickInterval || '1day';
			
			code = `gantt\n`;
			
			// 添加标题（如果有）
			if (config.title) {
				code += `  title ${escapeMermaid(config.title)}\n`;
			}
			
			code += `  dateFormat ${dateFormat}\n  axisFormat ${axisFormat}\n  tickInterval ${tickInterval}\n`;
			
			// 按分组组织任务
			const sections: { [key: string]: GanttTask[] } = {};
			let hasSections = false;
			
			tasks.forEach(t => {
				if (t.section) {
					hasSections = true;
					if (!sections[t.section]) {
						sections[t.section] = [];
					}
					sections[t.section].push(t);
				} else {
					if (!sections['默认']) {
						sections['默认'] = [];
					}
					sections['默认'].push(t);
				}
			});
			
			// 生成分组和任务代码
			Object.entries(sections).forEach(([sectionName, sectionTasks]) => {
				if (hasSections) {
					code += `  section ${escapeMermaid(sectionName)}\n`;
				}
				sectionTasks.forEach(t => {
					if (t.isMilestone) {
						// 里程碑任务
						code += `  ${escapeMermaid(t.name)} :milestone, ${t.startDate}, 0d\n`;
					} else {
						// 普通任务
						const status = t.status ? `${t.status}, ` : '';
						code += `  ${escapeMermaid(t.name)} :${status}${t.startDate}, ${t.endDate}\n`;
					}
				});
			});
			break;
		}
		case 'sequence': {
			const participants = data.participants || [];
			const messages = data.messages || [];
			code = `sequenceDiagram\n`;
			
			participants.forEach(p => {
				if (p.type === 'actor') {
					code += `  actor ${escapeMermaid(p.name)}\n`;
				} else {
					code += `  participant ${escapeMermaid(p.name)}\n`;
				}
			});
			
			// 箭头类型映射
			const arrowMap: Record<string, string> = {
				'实线带箭头': '->>',
				'实线无箭头': '->',
				'虚线无箭头': '-->',
				'虚线带箭头': '-->>',
				'实线叉号': '-x',
				'虚线叉号': '--x',
				'实线异步': '-)',
				'虚线异步': '--)'
			};
			
			messages.forEach(m => {
				if (m.from && m.to) {
					const arrow = arrowMap[m.arrow] || '->>';
					code += `  ${m.from}${arrow}${m.to}: ${escapeMermaid(m.text)}\n`;
				}
			});
			break;
		}
		case 'pie': {
			const items = data.items || [];
			const config = data.config || {};
			
			// 构建饼图代码
			code = `pie`;
			
			// 添加showData选项
			if (config.showData) {
				code += ` showData`;
			}
			
			// 添加标题
			if (config.title) {
				code += `\n  title ${escapeMermaid(config.title)}`;
			}
			
			code += `\n`;
			
			// 添加数据项
			items.forEach(i => code += `  "${escapeMermaid((i as any).label)}" : ${(i as any).value || 0}\n`);
			break;
		}
		case 'mindmap': {
			const tree = data.tree || [];
			code = `mindmap\n`;
			const valid = tree.filter(n => n.text);
			if (valid.length === 0) code += `  根节点\n`;
			else {
				valid.forEach(n => {
					const indent = '  '.repeat((n.level || 0) + 1);
					code += `${indent}${escapeMermaid(n.text)}\n`;
				});
			}
			break;
		}
		case 'sankey': {
			// 优先使用映射结构，如果没有则使用链接数组
			const map = data.map;
			const links = data.links || [];
			
			// 添加配置
			const config = data.config || {};
			if (config.showValues !== undefined) {
				code += `---\nconfig:\n  sankey:\n    showValues: ${config.showValues}\n---\n`;
			}
			
			// 添加sankey-beta关键字
			code += `sankey-beta\n`;
			
			// 添加链接数据
			if (map) {
				// 使用映射结构
				Object.entries(map).forEach(([source, targets]) => {
					targets.forEach(targetObj => {
						const sourceEscaped = escapeMermaid(source);
						const targetEscaped = escapeMermaid(targetObj.target);
						const value = targetObj.value || 0;
						code += `${sourceEscaped},${targetEscaped},${value}\n`;
					});
				});
			} else {
				// 使用链接数组
				links.forEach(link => {
					const source = escapeMermaid(link.source);
					const target = escapeMermaid(link.target);
					const value = link.value || 0;
					code += `${source},${target},${value}\n`;
				});
			}
			break;
		}
		default: code = 'graph TD\n  Error';
	}
	
	return code;
}