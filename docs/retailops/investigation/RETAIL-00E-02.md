# RETAIL-00E-02 公开经营数据可行性调查

调查日期：2026-11-26。目标：仅调查公开经营数据、许可、真实样本和时间边界，不训练、不实现导入器或后续算法。

## 结论摘要

- 数据集 FreshRetailNet-50K 固定数据卡 revision：c374e85975c82816c495acfa904cc55ab14a47d3。数据卡标注版本 v1.0、CC BY 4.0，发布日期 2025-05-08；卡片最后修改日期 2026-10-09。[固定数据卡版本](https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K/blob/c374e85975c82816c495acfa904cc55ab14a47d3/README.md#L86-L107)
- Hugging Face Dataset Viewer /filter 按 store_id=0 AND product_id=38 分别查询 train/eval，返回公开真实样本90+7=97行，partial=false。该单序列样本本身不代表整店或全数据集。
- 2026-11-26 对同一编码门店 store_id=0 的全部公开筛选结果分页复核：train 6,660行/74 SKU，eval 518行/同一74 SKU；每个SKU均有90+7天，74条序列共同覆盖连续97天。该结果是数据集编码门店范围内的覆盖证据，不是对现实门店或全数据集的外推；复现脚本和哈希见文末最终复验。
- train.parquet 为106,436,287 bytes（>100MB），未下载；eval.parquet 也未整文件下载。样本只在本任务被忽略的 data/retail-00e-02/，不得提交。
- 97行字段、日期、唯一键和缺货标签校验通过。小时销量与日销量使用1e-9容差比较；不使用浮点精确相等断言。
- 候选日期划分：官方 train 前76天用于训练，后14天用于验证；官方 eval 7天只用于测试。此为后续验证的数据边界建议，不代表模型训练或算法验收。最终分页扫描确认 store_id=0 的74个SKU均覆盖同一官方97天窗口；不将该结果外推至其他store_id。
- 未训练模型、未安装依赖、未修改业务源码。初始 npm run docs:check 曾受公共路线图坏链阻塞；PR #81 合并后已在本任务 Worktree 复跑并通过，历史失败保留在节点回执。

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

## 候选门店-SKU覆盖、样本选择和重复抽样验证

本次候选为编码门店 store_id=0 与商品 product_id=38 的一条 store-product 序列。选择依据是用精确过滤条件可重复取到 train/eval 两个split的完整连续series，适合验证数据结构、官方split边界与缺货标签；不是随机或代表性抽样，也没有混拼其它门店或商品。

| 覆盖口径 | 实证结果 | 边界 |
|---|---|---|
| 编码门店 | 1（store_id=0） | 无真实门店名称/身份映射 |
| SKU | 1（product_id=38） | 只覆盖一个编码商品 |
| train | 90日，2024-03-28至2024-06-25 | 原始train split |
| eval | 7日，2024-06-26至2024-07-02 | 原始eval split |
| 单series合并窗口 | 97日连续、相邻、无重叠 | 仅适用于本条序列 |
| store_id=0全部SKU数/覆盖率 | 未测量 | 未枚举门店商品目录，不能称为单店全品类覆盖 |

2026-11-26复核 Hugging Face revision API，main 为 c374e85975c82816c495acfa904cc55ab14a47d3。对相同config/filter的train和eval各重复查询两次；每个split两次响应字节完全相同，且逐字节匹配忽略目录缓存。所有返回行均仅属于 (0,38)。train SHA-256 39cddd2a1620018cdd9f5f3590a7f9d787ed48276a4c220a4eda971bdfc88f27；eval SHA-256 51861701a136ccfef089eb675cf9ee22d6216dda79854a621fe0cfc4344d9a9a。API请求无revision参数；重复验证只证明该查询窗口可重复，仍需同时保存数据revision和内容哈希。

## 19字段类型、单位和结构

字段类型来自API feature metadata。单位只按数据卡明确内容填写，未说明的不猜测换算。

| 字段 | API类型 | 含义/单位边界 |
|---|---|---|
| city_id | int64 | 编码ID，无现实单位 |
| store_id | int64 | 编码ID，无现实单位 |
| management_group_id | int64 | 编码ID |
| first_category_id | int64 | 编码品类ID |
| second_category_id | int64 | 编码品类ID |
| third_category_id | int64 | 编码品类ID |
| product_id | int64 | 编码SKU ID |
| dt | string | YYYY-MM-DD日期 |
| sale_amount | float64 | 提供方归一化日销量；实际数量系数未提供 |
| hours_sale | list<float64> | 24项归一化小时销量；不是件数/金额 |
| stock_hour6_22_cnt | int32 | 06:00–22:00时段的缺货小时数 |
| hours_stock_status | list<int64> | 24项状态，样本仅0/1 |
| discount | float64 | 无量纲折扣指标；1无折扣，0.9为优惠10% |
| holiday_flag | int32 | 整数标志 |
| activity_flag | int32 | 整数标志 |
| precpt | float64 | 天气数值；schema未给可复用业务单位 |
| avg_temperature | float64 | 天气数值；具体单位未由schema确认 |
| avg_humidity | float64 | 天气数值；具体单位未由schema确认 |
| avg_wind_level | float64 | 天气等级；无零售换算单位 |

样本唯一键为 (store_id, product_id, dt)。97/97无空值、键唯一、日期连续；小时向量长度24。stock_hour6_22_cnt与hours_stock_status[6:22]的求和97/97精确相等。sum(hours_sale)与sale_amount以绝对误差1e-9检查：eval 7/7精确相等；train 11/90有浮点尾差但最大4.440892098500626e-16，全部通过。缺货日 train 33/90、eval 1/7仅为此series统计。

## 可复现筛选和profile命令

以下脚本已在本任务worktree实际执行，退出码0。第一段校验数据卡main SHA并重复请求两次，与忽略目录响应逐字节比较；第二段校验schema、标量/数组类型、缺失值、唯一键、日期连续、单一store-SKU、缺货公式和销量容差。网络过滤每次最多100行，不请求Parquet大文件。需要Python 3标准库。

    python3 - <<'PY'
    import datetime, hashlib, json, pathlib, urllib.request

    repo = "Dingdong-Inc/FreshRetailNet-50K"
    sha = "c374e85975c82816c495acfa904cc55ab14a47d3"
    with urllib.request.urlopen(
        f"https://huggingface.co/api/datasets/{repo}/revision/main", timeout=30
    ) as response:
        assert json.load(response)["sha"] == sha

    expected = {
        "city_id":"int64", "store_id":"int64", "management_group_id":"int64",
        "first_category_id":"int64", "second_category_id":"int64",
        "third_category_id":"int64", "product_id":"int64", "dt":"string",
        "sale_amount":"float64", "hours_sale":"list<float64>",
        "stock_hour6_22_cnt":"int32", "hours_stock_status":"list<int64>",
        "discount":"float64", "holiday_flag":"int32", "activity_flag":"int32",
        "precpt":"float64", "avg_temperature":"float64",
        "avg_humidity":"float64", "avg_wind_level":"float64"
    }
    int_fields = [
        "city_id","store_id","management_group_id","first_category_id",
        "second_category_id","third_category_id","product_id",
        "stock_hour6_22_cnt","holiday_flag","activity_flag"
    ]
    float_fields = [
        "sale_amount","discount","precpt","avg_temperature","avg_humidity",
        "avg_wind_level"
    ]
    by_split = {}
    for split, count in (("train",90),("eval",7)):
        url = (
            f"https://datasets-server.huggingface.co/filter?dataset={repo}"
            f"&config=default&split={split}"
            "&where=%22store_id%22%3D0+AND+%22product_id%22%3D38"
            "&offset=0&length=100"
        )
        a = urllib.request.urlopen(url, timeout=60).read()
        b = urllib.request.urlopen(url, timeout=60).read()
        local = pathlib.Path(
            f"data/retail-00e-02/{split}-store0-product38.json"
        ).read_bytes()
        assert a == b == local
        obj = json.loads(a)
        assert obj["partial"] is False and len(obj["rows"]) == count
        types = {}
        for f in obj["features"]:
            spec = f["type"]
            types[f["name"]] = (
                spec["dtype"] if spec.get("_type") == "Value"
                else "list<" + spec["feature"]["dtype"] + ">"
            )
        assert types == expected
        rows = [x["row"] for x in obj["rows"]]
        assert all(set(r) == set(expected) for r in rows)
        assert not any(v is None for r in rows for v in r.values())
        assert {(r["store_id"],r["product_id"]) for r in rows} == {(0,38)}
        dates = [datetime.date.fromisoformat(r["dt"]) for r in rows]
        assert len(set(dates)) == count
        assert all((y-x).days == 1 for x,y in zip(dates,dates[1:]))
        for r in rows:
            assert all(type(r[k]) is int for k in int_fields)
            assert all(type(r[k]) is float for k in float_fields)
            assert type(r["dt"]) is str
            assert len(r["hours_sale"]) == len(r["hours_stock_status"]) == 24
            assert all(type(v) is float for v in r["hours_sale"])
            assert all(type(v) is int and v in (0,1) for v in r["hours_stock_status"])
            assert r["stock_hour6_22_cnt"] == sum(r["hours_stock_status"][6:22])
            assert abs(sum(r["hours_sale"])-r["sale_amount"]) <= 1e-9
        keys = [(r["store_id"],r["product_id"],r["dt"]) for r in rows]
        assert len(keys) == len(set(keys)) == count
        by_split[split] = rows
        print(split,count,hashlib.sha256(a).hexdigest(),dates[0],dates[-1])
    end = datetime.date.fromisoformat(by_split["train"][-1]["dt"])
    start = datetime.date.fromisoformat(by_split["eval"][0]["dt"])
    assert end + datetime.timedelta(days=1) == start
    keys = [(r["store_id"],r["product_id"],r["dt"])
            for split in ("train","eval") for r in by_split[split]]
    assert len(keys) == len(set(keys)) == 97
    print("PASS: revision/reselection/schema/type/null/key/date/store-SKU/label/1e-9")
    PY

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

## 单SKU V0与多SKU V1适用条件

场景说明V0先做单SKU临期折扣闭环，V1再扩展少量/约20–50个SKU、需求预测、缺货诊断和共享库存（[固定场景V0范围](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/docs/retailops/initial-plan-v0.2/RETAILOPS-SCENARIO-V0.2.md#L27-L43)、[V0/V1阶段](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/docs/retailops/initial-plan-v0.2/RETAILOPS-SCENARIO-V0.2.md#L77-L78))。

- V0候选：本样本只可作为单SKU归一化历史销量和缺货标签的离线研究输入；不足以支持临期折扣的经营动作。后续V0仿真必须把批次数量、到期日、可售状态、单位成本/售价、初始可用库存、价格响应另行标成SIMULATED，固定种子和假设，不得混入或伪装成PUBLIC_HISTORICAL。本调查未训练模型、未生成决策、未运行仿真。
- V1候选：最终复验已在同一编码门店 store_id=0 的公开筛选结果中确认74个共同SKU、每个SKU连续97天，数据层面足以支持后续选择20–50个编码SKU做多序列研究。SKU选择标准仍需预先明确并保留product_id、逐条覆盖与来源；该证据不代表现实门店的完整商品覆盖。共享库存、线上订单预占/完成/取消、采购和批次字段仍缺失，不能据此开展真实经营闭环。此前单SKU结论是当时抽样范围；以文末最终分页复验为准。

## 场景要求但FreshRetailNet缺失的业务字段

以下按场景对单店共享库存、批次、线上/线下、采购/补货、价格和损耗的要求核对（[场景数据边界与流程](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/docs/retailops/initial-plan-v0.2/RETAILOPS-SCENARIO-V0.2.md#L27-L43)、[经营测算](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/docs/retailops/initial-plan-v0.2/RETAILOPS-SCENARIO-V0.2.md#L47)、[评估要求](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/docs/retailops/initial-plan-v0.2/RETAILOPS-SCENARIO-V0.2.md#L68-L71)）。下表字段均不在本数据集本次19列内：

| 业务域 | 缺失字段/当前事实 | 影响 |
|---|---|---|
| 门店主数据 | store_id到真实门店、地点/时区、营业日历/时段的映射 | 无法确认物理门店或本地营业时间 |
| SKU主数据 | 商品名、计量单位（件/盒/kg）、单位换算/归一化系数、保质期/储存条件、可售质量状态 | 无法转为实物销量、判断临期或适售 |
| POS流水 | 小票/订单行ID、交易时间和时区、实际数量/单位、原价/成交价/金额、退货/作废 | 日汇总不能还原真实成交、金额及销售渠道 |
| 渠道和订单生命周期 | 线上/线下来源、线上预占/完成/取消状态及时间、共享库存扣减记录 | 不能还原双渠道库存或避免重复扣库 |
| 库存和批次 | 在手/可售/预占/冻结/在途数量、快照时间、lot/batch ID、收货时间、到期日、质量状态、报损/报废/残值 | 缺货时数不是库存数量，不能执行临期/补货流程 |
| 采购和供应 | 供应商、采购成本、订单量、最小订量、提前期、采购单和收货记录 | 无法计算实际补货量、成本和供应约束 |
| 价格和促销 | 实际售价、促销活动ID/时间/规则、成本、价格变更历史、价格响应/因果证据、审批政策 | discount不能恢复实际售价或因果价格弹性 |
| 经营结果和政策 | 实际损耗率、废弃成本、毛利/税费/履约费用、政策版本及阈值 | 不能计算真实利润或声称生产收益 |

该缺失清单针对已批准场景和当前数据卡，说明FreshRetailNet不能独立提供完整经营闭环；后续授权数据源或仿真字段需单独分类。

## PUBLIC_HISTORICAL / SIMULATED / DERIVED来源映射

遵守场景数据分层（[固定来源分层约定](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/docs/retailops/initial-plan-v0.2/RETAILOPS-SCENARIO-V0.2.md#L27-L33)）：

| 数据对象 | 来源类型 | 必须记录/当前边界 |
|---|---|---|
| filter响应的原始19字段、store_id/product_id/date及历史标签 | PUBLIC_HISTORICAL | URL、revision、CC BY 4.0、过滤条件、响应/源文件SHA、采样日期；提供方归一化的sale_amount仍是公开历史字段，单位系数未知 |
| 本报告profile、日期分割、由缺货小时计数派生的布尔标志、今后生成的聚合/编码 | DERIVED | 记录计算公式、代码或报告版本、上游样本SHA和时间窗；不得覆写源字段或伪装原始观测 |
| V0/V1仿真新增的批次、库存、成本/售价、到期日、供应商、订单流、价格响应 | SIMULATED | 记录生成器、固定种子和参数；不声称真实历史、真实商户或真实经济结果 |
| POS、ERP、真实设备和实时传感器 | LIVE_DEVICE | 本任务没有该类接入或数据证据，当前状态为不存在 |

## 时间切分和未来信息防控补充

候选日期仍为train 2024-03-28至06-11、validation 06-12至06-25、test 06-26至07-02。若以后执行预测验证：
1. 先按dt切分，再拟合转换/填补；禁止随机行切分或同日跨集合。
2. 归一化、缺失处理、阈值、统计汇总、特征选择只能用train拟合；validation用于开发选择，test保持封存并仅在固定评估时使用。
3. 天气/促销只有在预测发出时真实已知的未来特征才可输入。数据中的事后观测值不能默认属于预测时可用数据。
4. stock_hour6_22_cnt是目标日结果标签，只能在预测后定义条件性指标，不能作预测输入、划分依据或提前筛选。固定基线evaluation()第66/70行按stock_hour6_22_cnt==0过滤指标；后续报告须同时披露过滤后样本数和日期覆盖，且不能把“无缺货日”误称为总体误差。
5. 记录每个split的日期范围、样本数和缺失分布；series不覆盖固定窗口时单列说明，不向未来填充。

本节为调查/验收边界建议；未实施模型、导入逻辑或生产运行。

## 使用边界、缺失项与回滚

- 使用时署名并保留 CC BY 4.0；论文引用遵守固定数据卡。
- sale_amount/hours_sale 只可当归一化数值。转成件数、损耗、金额须确认归一化系数。
- 不把编码 ID 映射成真实商户/商品；不将单条序列外推为全门店或总体覆盖。
- 未训练模型、未接真实门店接口、未实现数据导入或下游算法；不得作为 #21 能力验收证据。
- 待确认：归一化系数及稳定性、ID业务映射、天气变量单位和来源、全量日期/缺失分布、数据更新策略、生产用途范围。
- 本分支只新增调查报告、节点回执和可复现分析脚本，不修改业务源码、依赖、配置或原始数据；样本不在 diff。回滚为单独 revert 文档提交。


## 最终复验：同一编码门店的 SKU 覆盖与共同日期窗口

复验日期：2026-11-26。固定数据卡 revision 为 `c374e85975c82816c495acfa904cc55ab14a47d3`；分页扫描前后查询 `revision/main` 均为该 SHA。使用 Hugging Face Dataset Viewer `/filter` 对 `store_id=0` 分别扫描 `train` 和 `eval`，每页 `length=100`，完整消费全部页；没有下载 Parquet 文件，也没有提交原始数据。

| Split | 公开筛选行数 | 页数 | 唯一 product_id | 每SKU天数 | 唯一 (store_id, product_id, dt) | 分页响应聚合 SHA-256 |
|---|---:|---:|---:|---:|---:|---|
| train | 6,660 | 67 | 74 | 90 | 6,660 | `60b5ee76e48f94549b74d21119b7b249b409edbf2748a56327cf9bc536f4ee85` |
| eval | 518 | 6 | 74 | 7 | 518 | `f710d7bea6428190da664ada60869fca4b09b1a556f6a47579ebc916d6af671c` |

两个 split 的 SKU 集合完全一致：74 个共同 `product_id`，无 train-only 或 eval-only SKU。每个 SKU 的 train 日期连续覆盖 2024-03-28 至 2024-06-25；eval 日期连续覆盖 2024-06-26 至 2024-07-02。74条序列共同日期交集为 2024-03-28 至 2024-07-02，连续97天，无缺日；split 间日期不重叠，复合键无重复。API `partial=false`，实际行数等于各自 `num_rows_total`。

分页响应哈希算法：按 offset 递增顺序，对每个响应 body 先输入其 8 字节大端长度，再输入原始 body 字节，最终取 SHA-256。可复现命令（Python 3 标准库、网络访问 Hugging Face）：

    python3 docs/retailops/investigation/RETAIL-00E-02-store-coverage.py

脚本固定检查数据 revision 前后不变，分页检查 `partial`、总行数、页长、门店范围、SKU 集合、每SKU行数、复合键唯一性、每SKU日期连续性和共同日期窗口；本轮执行退出码0。脚本不保存或输出原始销售记录。

**多SKU扩展判断：** 在该数据集公开编码范围内，store_id=0 有74个满足完整共同97天覆盖的SKU，数量上足以从中按预先说明的标准选择20–50个编码SKU，开展后续多序列数据质量或预测研究。不得把编码门店称为已识别的真实门店，不得声称74个SKU覆盖现实门店完整商品目录；商品实物单位/归一化系数、库存、批次、线上订单生命周期、采购和真实成本仍缺失。此调查未选择或拼接跨门店样本，未训练模型、开发导入模块或声称算法验收通过。
