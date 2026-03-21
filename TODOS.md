# TODOS

## 管理员后台（收费系统）
**What:** 一个简单的内部管理页面，查看所有注册商家、当前套餐（Free/Pro）、本月用量。
**Why:** 当前无管理界面，手动升级/降级套餐需要用 Redis CLI，商家数量增加后会很麻烦。
**Pros:** 运营效率，能快速处理商家问题（误扣费、手动送 Pro 试用等）。
**Cons:** 需要单独的 admin 认证，多几个页面和路由。
**Context:** 收费系统上线后，套餐变更靠 Stripe Webhook 自动处理。只有在 webhook 失败/退款/人工赠送时才需要手动干预。上线初期用 Redis CLI 临时处理。等商家超过 10 个再建。
**Depends on:** 收费系统（merchant service + Stripe）上线后。
