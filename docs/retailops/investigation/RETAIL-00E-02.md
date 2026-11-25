# RETAIL-00E-02 公开经营数据可行性调查

调查日期：2026-11-26。目标：仅调查公开经营数据、许可、真实样本和时间边界，不训练、不实现导入器或后续算法。

## 结论摘要

- 数据集 FreshRetailNet-50K 固定数据卡 revision：c374e85975c82816c495acfa904cc55ab14a47d3。数据卡标注版本 v1.0、CC BY 4.0，发布日期 2025-05-08；卡片最后修改日期 2026-10-09。[固定数据卡版本](https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K/blob/c374e85975c82816c495acfa904cc55ab14a47d3/README.md#L86-L107)
- Hugging Face Dataset Viewer /filter 按 store_id=0 AND product_id=38 分别查询 train/eval，返回公开真实样本90+7=97行，partial=false。该样本只证明一条编码门店-商品序列有覆盖，不能代表整店或全数据集。
- train.parquet 为106,436,287 bytes（>100MB），未下载；eval.parquet 也未整文件下载。样本只在本任务被忽略的 data/retail-00e-02/，不得提交。
- 97行字段、日期、唯一键和缺货标签校验通过。小时销量与日销量使用1e-9容差比较；不使用浮点精确相等断言。
- 候选日期划分：官方 train 前76天用于训练，后14天用于验证；官方 eval 7天只用于测试。此为后续验证的数据边界建议，不代表模型训练或算法验收。
- 未训练模型、未安装依赖、未修改业务源码。npm run docs:check 存在已知基线坏链，已如实记录；本任务不修复无关文档。

## 版本、来源与许可

| 项目 | 证据 |
|---|---|
| 数据来源 | [Dingdong-Inc/FreshRetailNet-50K](https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K) |
| 数据卡 SHA | c374e85975c82816c495acfa904cc55ab14a47d3（调查时 main revision） |
| 发布信息 | v1.0，2025-05-08；[数据卡](https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K/blob/c374e85975c82816c495acfa904cc55ab14a47d3/README.md#L86-L107) |
| 数据许可 | CC BY 4.0；使用需注明署名、来源并保留许可信息 |
| 基线代码 | Dingdong-Inc/frn-50k-baseline，固定 SHA 8af694a09a5a427d1d50648d348c022565a781f2；代码 LICENSE 为 Apache-2.0，与数据许可区分 |
| 卡片全局声明 | 约50,000条 store-product 90日序列、898家门店、18个主要城市、865种生鲜 SKU；这些为卡片陈述，未由本次单条样本独立验证。[概况和字段表](https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K/blob/c374e85975c82816c495acfa904cc55ab14a47d3/README.md#L25-L49) |

固定数据 tree 的 LFS 元信息：

| 文件 | 大小 | LFS SHA-256 | 本次处理 |
|---|---:|---|---|
| train.parquet | 106,436,287 bytes | 6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d | >100MB，未下载，使用筛选 API |
| eval.parquet | 8,440,124 bytes | 1b118840664280c6b88bffc84c80ee1f54c05d911e354b7599e5da10995e960e | 未下载，使用筛选 API |

[筛选 API 文档](https://huggingface.co/docs/dataset-viewer/filter#L84-L112)说明 /filter 支持 Parquet 数据集筛选，length 最大100。本次 URL 未带 revision 参数，因此 URL 本身不是不可变引用。采样前后核对数据集 main SHA 均为 c374…；每个响应另记本地内容 SHA-256。

## 字段含义与单位限制

数据卡固定字段表见 [README 第34–49行](https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K/blob/c374e85975c82816c495acfa904cc55ab14a47d3/README.md#L34-L49)。

| 字段 | 含义与限制 |
|---|---|
| city_id、store_id、management_group_id | 编码标识；样本均为0，未确认映射到自然语言门店身份 |
| first_category_id、second_category_id、third_category_id、product_id | 编码品类/商品标识；product_id=38 不能解释成已知商品名 |
| dt | ISO YYYY-MM-DD 日期 |
| sale_amount | 日销量，经数据卡所述归一化系数处理；数据中无恢复实际件数、重量或金额的系数，不能作为实际单位 |
| hours_sale | 24项小时销量，同样归一化，不能视为金额或件数 |
| stock_hour6_22_cnt | 每日06:00–22:00缺货小时计数，是缺货标签而非数量 |
| hours_stock_status | 24项小时库存状态；样本值为0/1 |
| discount | 折扣指标；卡片示例1为无折扣，0.9为优惠10% |
| holiday_flag、activity_flag | 节假日、活动标志 |
| precpt、avg_temperature、avg_humidity、avg_wind_level | 天气特征；字段表不足以支持实际经营单位换算 |

## 样本请求、哈希与 profile

过滤条件：store_id=0 AND product_id=38，config=default，offset=0，length=100。真实公开样本，不是模拟数据：

- [train 请求](https://datasets-server.huggingface.co/filter?dataset=Dingdong-Inc%2FFreshRetailNet-50K&config=default&split=train&where=%22store_id%22%3D0+AND+%22product_id%22%3D38&offset=0&length=100)：90行，row_idx 633–1063，2024-03-28至2024-06-25，partial=false。ignored 文件 train-store0-product38.json，SHA-256 39cddd2a1620018cdd9f5f3590a7f9d787ed48276a4c220a4eda971bdfc88f27。
- [eval 请求](https://datasets-server.huggingface.co/filter?dataset=Dingdong-Inc%2FFreshRetailNet-50K&config=default&split=eval&where=%22store_id%22%3D0+AND+%22product_id%22%3D38&offset=0&length=100)：7行，row_idx 302–335，2024-06-26至2024-07-02，partial=false。ignored 文件 eval-store0-product38.json，SHA-256 51861701a136ccfef089eb675cf9ee22d6216dda79854a621fe0cfc4344d9a9a。

WSL2 Ubuntu 24.04 上用 Python 3 标准库读取两个 JSON profile，退出码0。结果：

- 两个响应各19字段；97行无 null；日期唯一且逐日连续。
- (store_id, product_id, dt) 复合键97/97唯一；train/eval无日期重叠，train末日06-25、eval首日06-26。
- hours_sale 和 hours_stock_status 长度均为24；hours_stock_status 值仅0/1。
- stock_hour6_22_cnt 与 sum(hours_stock_status[6:22]) 97/97精确匹配；该序列 train 缺货33/90天、eval缺货1/7天。不能外推总体缺货率。
- sum(hours_sale) 与 sale_amount：eval 7/7精确相等；train有11/90行出现二进制浮点尾差，最大绝对误差4.440892098500626e-16；97/97均在1e-9误差内。
- sale_amount范围：train 0.0–3.3，eval 0.0–3.5；discount范围0.5–1.0，不能据此推导物理单位。

API row_idx 不保证跨版本稳定；可复现依据是数据 revision、官方 LFS SHA、过滤条件及响应 SHA。样本存于 data/retail-00e-02/；.gitignore 第10行 /data/ 规则命中，样本未 stage、不得提交。

## N3 候选时间边界与未来泄漏检查

| 子集 | 日期 | 本次单序列天数 |
|---|---|---:|
| train | 2024-03-28–2024-06-11（官方 train 前76天） | 76 |
| validation | 2024-06-12–2024-06-25（官方 train 后14天） | 14 |
| test | 2024-06-26–2024-07-02（官方 eval 原7天） | 7 |

这是未训练模型的边界建议。推广到其它序列之前，必须检查具体日期覆盖、缺失、官方 split；不从一条样本推断全体97天覆盖。

固定基线源码 [ssa_forecasting.py @ 8af694a09a5a427d1d50648d348c022565a781f2](https://github.com/Dingdong-Inc/frn-50k-baseline/blob/8af694a09a5a427d1d50648d348c022565a781f2/demand_forecasting/SSA/ssa_forecasting.py) 的静态证据（以下为文件内1-based行号）：

- ssa_predict() 函数定义在第5行；第7–9行加载官方 eval、与历史输入拼接并按 store/product/date 排序（[固定源码行](https://github.com/Dingdong-Inc/frn-50k-baseline/blob/8af694a09a5a427d1d50648d348c022565a781f2/demand_forecasting/SSA/ssa_forecasting.py#L5-L9)）。第19–22行按97步整形并设 encoder length=90（[固定源码行](https://github.com/Dingdong-Inc/frn-50k-baseline/blob/8af694a09a5a427d1d50648d348c022565a781f2/demand_forecasting/SSA/ssa_forecasting.py#L19-L22)）。
- 第47行计算 mu 时筛选 dt <= 2024-06-25；第50行选择 dt >= 2024-06-26 作为预测/评估区间（[固定源码行](https://github.com/Dingdong-Inc/frn-50k-baseline/blob/8af694a09a5a427d1d50648d348c022565a781f2/demand_forecasting/SSA/ssa_forecasting.py#L47-L50)）。
- evaluation() 函数定义在第66行，第70行只保留 stock_hour6_22_cnt == 0 的记录计算指标（[固定源码行](https://github.com/Dingdong-Inc/frn-50k-baseline/blob/8af694a09a5a427d1d50648d348c022565a781f2/demand_forecasting/SSA/ssa_forecasting.py#L66-L70)）。
- 上述源码支持“按时间隔离历史目标与官方 eval”的静态检查，不代表已运行基线；没有验证模型表现、预测质量、外生特征的真实可用时点或算法验收。

## 使用边界、缺失项与回滚

- 使用时署名并保留 CC BY 4.0；论文引用遵守固定数据卡。
- sale_amount/hours_sale 只可当归一化数值。转成件数、损耗、金额须确认归一化系数。
- 不把编码 ID 映射成真实商户/商品；不将单条序列外推为全门店或总体覆盖。
- 未训练模型、未接真实门店接口、未实现数据导入或下游算法；不得作为 #21 能力验收证据。
- 待确认：归一化系数及稳定性、ID业务映射、天气变量单位和来源、全量日期/缺失分布、数据更新策略、生产用途范围。
- 本分支只新增调查报告和节点回执，不修改业务源码、依赖、配置或原始数据；样本不在 diff。回滚为单独 revert 文档提交。
