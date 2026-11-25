# OpenDot-RetailOps WSL2 开发环境

记录日期：2026-11-25。本文记录 RETAIL-00A-ENV 的实际安装结果；命令均在现有 `Ubuntu` 发行版中执行，未迁移或删除发行版，未改动 Windows 安全设置，也未复制 Windows `node_modules`。

## 环境结论

环境搭建成功。Ubuntu 运行于 WSL2，项目位于 Linux ext4 文件系统，Node.js、构建工具、Codex、Docker Desktop WSL Integration、Playwright Chromium 和 VS Code Remote WSL 均可用。项目测试结论另见 `docs/retailops/acceptance/RETAIL-00A-LINUX.md`，不能由本结论推导为项目全量通过。

## 主机与存储

| 项目 | 实际值 |
|---|---|
| Windows | Windows 10 家庭中文版 10.0.19045，x64 |
| CPU / 内存 | Intel Core i9-12900H，20 逻辑处理器；31.80 GiB 物理内存 |
| WSL | 3.0.5.0；内核 6.18.58.1-1；默认版本 2 |
| Linux | Ubuntu 24.04.1 LTS，WSL2 |
| 发行版 VHDX | `C:\Users\Administrator\AppData\Local\Packages\CanonicalGroupLimited.Ubuntu_79rhkp1fndgsc\LocalState\ext4.vhdx` |
| VHDX 实际大小 | 安装前约 11.23 GiB；验收结束约 17.05 GiB |
| Linux 项目 | `/home/szz_user/projects/OpenDot-RetailOps`，约 2.9 GiB |
| Linux 文件系统 | ext4，约 1007 GiB 逻辑容量、948 GiB 可用（动态 VHD） |
| D 盘 | 931.20 GiB，总剩余约 610.99 GiB |

目标约束要求优先将“新建”的 WSL 虚拟磁盘放在 D 盘。本机已有合适的 Ubuntu 24.04 WSL2，故优先复用，未重复安装，也未冒险迁移现有 VHDX。若未来新建独立发行版，应先确认 `wsl --install --location` 支持情况，再使用 `D:\WSL\Ubuntu-24.04`；本次不执行迁移。

Windows WMI 返回 `HypervisorPresent=True`，而固件虚拟化字段返回 `False`；实际 Ubuntu 与 Docker Desktop 均稳定运行在 WSL2，说明虚拟化运行链路可用，该 WMI 固件字段不作为 BIOS 关闭的结论。本次无需进入 BIOS，也无需重启 Windows。

WSL 分配内存约 15 GiB；验收快照中使用 3.5 GiB、可用 12 GiB，Swap 4 GiB。nvm 约 672 MiB、Playwright 浏览器约 656 MiB、VS Code Server 约 681 MiB。

## 软件版本

| 软件 | 版本 / 路径 |
|---|---|
| nvm | 0.41.0，`/home/szz_user/.nvm` |
| Node.js | v24.22.3，Linux ELF x86-64 |
| npm | 11.19.1 |
| Git | 2.43.0 |
| GNU Make | 4.3 |
| Python | 3.12.3 |
| GCC / G++ | 13.3.0 |
| pkg-config | 1.8.1 |
| Codex CLI | 0.172.0 |
| Docker Desktop / Engine | 4.50.0 / 28.5.1 |
| Playwright | 1.62.1，Chromium 151.0.7922.34 |
| VS Code | 1.146.0；Remote WSL 扩展 1.104.7 |

`node`、`npm` 和 `codex` 均解析到 `/home/szz_user/.nvm/versions/node/v24.22.3/bin/`，没有使用 `/mnt/c` 下的 Windows 可执行文件。Linux 原始 PATH 中的 `code` 指向 Cursor；本次使用 Windows VS Code 的明确路径连接 WSL，最终 `code --status` 显示 Remote 为 `WSL: Ubuntu`，Linux remote-server 与 extension host 正常。

## 实际安装步骤

系统依赖：

```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential python3 make pkg-config
```

nvm、Node.js 与 Codex：

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 24
nvm alias default 24
nvm use 24
npm install -g @openai/codex
```

仓库：

```bash
mkdir -p ~/projects
git clone https://github.com/2Zest/OpenDot-RetailOps.git ~/projects/OpenDot-RetailOps
cd ~/projects/OpenDot-RetailOps
git fetch origin
git switch feat/retail-00a-baseline
```

三个 V0.1 规划文档从 Windows 工作区逐一复制，复制前确认目标不存在，复制后 SHA-256 完全一致。未迁移数据库、凭证、`node_modules`、构建缓存或未提交图标文件。

## Docker 与浏览器

Docker Desktop 已启用 Ubuntu WSL Integration。Ubuntu 中 `/usr/bin/docker` 使用 Linux client 并连接 Docker Desktop daemon；`docker version`、`docker info` 和 `docker run --rm hello-world` 均成功。未在 Ubuntu 内重复安装 Docker Engine，也未迁移 Docker 数据。

按照 CI 安装 Playwright：系统运行依赖由 root 安装，Chromium/FFmpeg/Headless Shell 由普通用户安装到 `~/.cache/ms-playwright`，避免 root 所有的用户缓存。

## POSIX 行为

在 Linux ext4 用户目录实际创建文件并执行 `chmod 600`、创建符号链接后，文件模式保持 `600` 且链接可正确解析。该结果满足符号链接与 POSIX 权限基线，不代表仓库内所有脚本都提交了正确的可执行位；实际发现 `scripts/sync-stream-event.sh` 在 Git 中为 `100644`，导致 `make typecheck` 失败。

## 日常使用

启动环境与项目：

```powershell
wsl -d Ubuntu
```

```bash
cd ~/projects/OpenDot-RetailOps
source ~/.nvm/nvm.sh
nvm use 24
docker version
npm start
```

从 Windows 打开 VS Code Remote WSL：

```powershell
& 'D:\workSpace\vscode\Microsoft VS Code\bin\code.cmd' --remote wsl+Ubuntu '/home/szz_user/projects/OpenDot-RetailOps'
```

停止应用使用前台终端 `Ctrl+C`。不使用时可在确认没有运行任务后执行：

```powershell
wsl --shutdown
```

Docker Desktop 独立启动和退出；不要同时启用另一个 Linux Docker daemon。

## 已知注意事项

- 现有 Ubuntu VHDX 位于 C 盘，这是复用既有发行版的结果，不是新建位置偏离。
- `npm ci` 报告锁定依赖中的现有漏洞告警；本任务没有运行 `npm audit fix`，也没有升级依赖。
- `npm run build:all` 会改写一组图标和 `web/public/manifest.webmanifest`。这些构建副作用未加入提交，也未擅自清除。
- Windows 原项目 `D:\workSpace\codeAgent\OpenDot` 保持原状，其未提交图标、manifest 和规划文档没有被覆盖或丢弃。
