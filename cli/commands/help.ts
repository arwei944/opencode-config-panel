/**
 * Command: help
 * 显示帮助信息
 */

import type { CommandHandler } from '../types';

export const helpHandler: CommandHandler = async (_args, ctx) => {
  if (ctx.options.json) {
    const { getCommandNames, getCommandDef } = await import('../registry');
    const names = getCommandNames();
    const commands = names.map(n => {
      const def = getCommandDef(n);
      return { name: n, aliases: def?.aliases || [], description: def?.description || '' };
    });
    ctx.term.jsonOut({ action: 'help', commands });
    return;
  }

  ctx.term.raw(`
occ — Opencode 配置管理 CLI 工具

用法:
  node scripts/occ.mjs [全局选项] <命令> [参数...]

全局选项:
  --json                         输出可机读 JSON
  -y, --yes                      跳过确认提示
  --dry-run                      预览但不写入
  -q, --quiet                    静默输出
  -v, --verbose                  详细输出
  --no-color                     关闭彩色输出

配置任务强制流程:
  1. 先执行 status 查看当前状态
  2. 再使用 occ 执行变更
  3. 变更后立即验证
  4. 失败时优先回滚

常用命令:
  状态查看:
    status                          显示配置概览
    get <键>                        获取配置值 (如 model, default_agent)
    doctor                          健康检查（providers/models/agents/skills/backups）
    log [tail|clear]                查看/清空审计日志
    list providers                  列出所有提供商
    list models [提供商]             列出模型
    list agents                     列出所有代理
    list tools                      列出所有工具
    tool list [--verbose]           列出工具详情
    tool reset                      重置工具配置
    list skills                     列出所有技能
    list mcp                        列出 MCP 服务器
    list backups                    列出备份

  配置修改:
    set <键> <值>                   设置配置值
    set-model <模型名>              设置主模型
    set-small-model <模型名>        设置轻量模型
    set-default-agent <代理名>      设置默认代理
    tool toggle <工具名>            切换工具开/关
    tool set <工具名> <true|false>  设置工具状态
    format                          格式化 opencode.json

   智能体管理:
    agent create <名称> [模式] <描述> [model]             创建智能体
    agent delete <名称>                                   删除智能体
    agent update <名称> [--desc] [--model] [--mode] ...   更新智能体属性
    agent set-permission <名称> <工具>=<动作> [...]        设置代理权限
    agent doctor                                          检查所有 agent 文件
    list agents [--verbose] [--filter <mode>]             列出代理（--verbose 详情）

   MCP 管理:
    mcp add <名称> --command <命令> [参数...]          添加本地 MCP 服务器
    mcp add <名称> --url <URL> [--header K=V]         添加远程 MCP 服务器
    mcp remove <名称>                                  删除 MCP 服务器
    mcp toggle <名称>                                  启用/禁用 MCP 服务器
    list mcp [--verbose]                               列出 MCP 服务器

   配置快捷设置:
    set logLevel DEBUG|INFO|WARN|ERROR  设置日志级别
    set autoupdate true|false|notify    设置自动更新
    set snapshot true|false             启用/禁用快照
    set share manual|auto|disabled      设置共享行为
    set shell <路径>                    设置默认 Shell
    set username <名称>                 设置用户名
    toggle <键>                         切换布尔值开关
    disabled-providers add|remove|list  管理禁用提供商
    enabled-providers set|clear|list    管理仅限提供商

   提供商管理:
    add provider <URL> [apiKey]              智能添加提供商
    remove provider <名称>                   删除提供商
    provider update <名称> [--timeout] [...]  更新提供商选项
    provider list-models <名称> [--verbose]  列出提供商模型详情
    provider test [名称...]                    测试 provider 连通性
    provider estimate <名称> [--input N] [--output N]  token/价格预估
    provider doctor                           检查所有 provider

   备份与回滚:
     backup create                       创建备份
     backup list                         列出备份
     backup restore <文件名>             恢复备份
     backup delete <文件名>              删除备份
     backup cleanup --keep <N|5d|12h>    按数量/时间清理
     backup diff <a> <b>                 两个备份对比
     backup watch --interval 10m         自动定时备份
     rollback                            一键回滚（交互选择备份）
     rollback <文件名>                   回滚到指定备份
     rollback --latest | -l              一键回滚到最新备份

   差异对比:
     diff <文件a> <文件b>                对比两个文件
     diff import <文件>                  对比当前配置与待导入文件
     diff rollback <备份>                对比当前配置与待回滚备份

   导入导出:
     export [文件路径] [--redact]        导出配置（--redact 脱敏 API Key）
     import <文件路径> [--validate-only]  导入配置 / 仅验证
     validate                            验证配置

   密钥管理:
    key list                            列出已存储的密钥
    key set <名称>                      存储密钥到 .keys.json
    key get <名称>                      读取密钥
    key delete <名称>                   删除密钥
    key export [文件路径] [--redact]    导出密钥
    key import <文件路径>               导入密钥

   模板与 Profile:
     template list|save|apply|show|delete|export|import <名称>   模板管理
     profile list|save|use|show|delete|export|import <名称>      多 profile 切换

   自定义命令:
    command add <名称> --template <模板> [...]   添加自定义命令
    command remove <名称>                       删除自定义命令
    list commands                               列出自定义命令

   引用管理:
    reference add <名称> <路径> [--description]   添加本地引用
    reference add <名称> <URL> --branch <分支>    添加 Git 引用
    reference remove <名称>                       删除引用
    list references                               列出引用

   高级配置:
    compaction set|show [--auto] [--prune] [--tail-turns] [--reserved]   上下文压缩配置
    tool-output set|show [--max-lines] [--max-bytes]                     工具输出阈值
    experimental set|list <特性> <true|false>                             实验性功能开关
    attachment set max-width|max-height|max-bytes <数字>                  图片附件限制
    skills create|remove|show|edit|doctor|add-path|add-url|list|list --verbose 管理技能路径

   服务器与插件:
    server set|show [--port] [--hostname] [--mdns] [--cors]              服务器配置
    plugin install <模块名> [--global] [--force]                         安装插件
    plugin remove <模块名>                                               移除插件
    plugin list                                                           列出插件

   JSON 直接操作:
    json get <路径>                       按 JSON 路径取值
    json set <路径> <值>                  按 JSON 路径设值
    json patch <路径> <{op,value}>        RFC 6902 patch（add/remove/replace/test）

   其他:
    self update                          自更新（占位）
    ui                                   启动 Web 控制台（占位）

   回归测试:
    npm run test:cli                     运行完整命令回归测试
    node scripts/test-cli.mjs            直接执行回归测试脚本

   常用速查:
    status                               查看配置概览
    doctor                               健康检查
    backup list                          查看备份列表
    template list                        查看模板列表
    profile list                         查看 profile 列表
    key list                             查看密钥列表

 示例:
  node scripts/occ.mjs status
  node scripts/occ.mjs get model
  node scripts/occ.mjs set model opencode/deepseek-v4-flash-free
  node scripts/occ.mjs list providers
  node scripts/occ.mjs add provider https://api.openai.com/v1 sk-xxx
  node scripts/occ.mjs tool toggle read
  node scripts/occ.mjs agent create my-agent subagent "我的自定义代理"
  node scripts/occ.mjs --json doctor
  node scripts/occ.mjs --dry-run set model b-ai/minimax-m3
  node scripts/occ.mjs diff import config.json
  npm run test:cli
`);
};
