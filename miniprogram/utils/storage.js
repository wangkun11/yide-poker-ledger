const M = require('./model');
// 微信客户端按微信用户 + AppID 隔离 Storage；不自造账号或使用设备 ID。
const KEY = 'yide-ledger-local-v1';
const clone = value => JSON.parse(JSON.stringify(value));
function load(api) {
  const raw = api.getStorageSync(KEY);
  if (raw === '' || raw === undefined || raw === null) return null;
  if (!raw || raw.version !== 1) throw Error('本地账本版本无法识别，原数据已保留');
  return clone(M.validate(raw.state));
}
function save(api, state) {
  const next = clone(M.validate(state));
  api.setStorageSync(KEY, {version: 1, state: next});
  return next;
}
module.exports = {KEY, load, save};
