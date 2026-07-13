module.exports=[18622,(e,t,s)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,s)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,s)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,s)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,s)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},14747,(e,t,s)=>{t.exports=e.x("path",()=>require("path"))},93695,(e,t,s)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},22734,(e,t,s)=>{t.exports=e.x("fs",()=>require("fs"))},85148,(e,t,s)=>{t.exports=e.x("better-sqlite3-90e2652d1716b047",()=>require("better-sqlite3-90e2652d1716b047"))},13547,47029,e=>{"use strict";var t=e.i(22734),s=e.i(14747),a=e.i(85148);let n=s.default.join(process.cwd(),"data"),r=s.default.join(n,"task-manager.db"),E=null;function i(){var e;let s,i;return E||(t.default.mkdirSync(n,{recursive:!0}),(E=new a.default(r)).pragma("foreign_keys = ON"),E.pragma("journal_mode = WAL"),(e=E).exec(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_accessed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      notebook_id INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      assignee TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      start_date TEXT,
      due_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      in_progress_at TEXT,
      done_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (task_id, tag),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      notebook_id INTEGER NOT NULL DEFAULT 0,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (notebook_id, key)
    );

    CREATE TABLE IF NOT EXISTS task_status_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notebook_id INTEGER NOT NULL DEFAULT 1,
      task_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_due_date_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notebook_id INTEGER NOT NULL DEFAULT 1,
      task_id INTEGER NOT NULL,
      from_due_date TEXT,
      to_due_date TEXT,
      changed_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_status_events_task_id ON task_status_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_status_events_changed_at ON task_status_events(changed_at);
    CREATE INDEX IF NOT EXISTS idx_due_date_events_task_id ON task_due_date_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_due_date_events_changed_at ON task_due_date_events(changed_at);
  `),s=function(e){let t=e.prepare("SELECT id FROM notebooks ORDER BY last_accessed_at DESC, id ASC LIMIT 1").get();if(t)return t.id;let s=new Date().toISOString();return Number(e.prepare(`
    INSERT INTO notebooks (name, created_at, updated_at, last_accessed_at)
    VALUES (?, ?, ?, ?)
  `).run("MAIN",s,s,s).lastInsertRowid)}(e),(i=e.prepare("PRAGMA table_info(tasks)").all()).some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE tasks ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${s}`).run(),i.some(e=>"sort_order"===e.name)||e.prepare("ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0").run(),i.some(e=>"progress"===e.name)||e.prepare("ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0").run(),e.prepare("PRAGMA table_info(subtasks)").all().some(e=>"sort_order"===e.name)||e.prepare("ALTER TABLE subtasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0").run(),function(e,t){let s=e.prepare("PRAGMA table_info(settings)").all(),a=s.some(e=>"notebook_id"===e.name),n=s.find(e=>"key"===e.name),r=s.find(e=>"notebook_id"===e.name),E=!!(n?.pk&&r?.pk);if(a&&E)return;e.exec(`
    CREATE TABLE IF NOT EXISTS settings_next (
      notebook_id INTEGER NOT NULL DEFAULT 0,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (notebook_id, key)
    );
  `);let i=e.prepare(a?"SELECT notebook_id, key, value, updated_at FROM settings":"SELECT key, value, updated_at FROM settings").all(),o=e.prepare(`
    INSERT OR REPLACE INTO settings_next (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
  `);for(let e of i){let s="geminiApiKey"===e.key?0:e.notebook_id||t;o.run(s,e.key,e.value,e.updated_at)}e.exec(`
    DROP TABLE settings;
    ALTER TABLE settings_next RENAME TO settings;
  `)}(e,s),e.prepare("PRAGMA table_info(task_status_events)").all().some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE task_status_events ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${s}`).run(),e.prepare("PRAGMA table_info(task_due_date_events)").all().some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE task_due_date_events ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${s}`).run(),e.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_notebook_id ON tasks(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status_sort_order ON tasks(status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_sort_order ON subtasks(task_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_settings_notebook_key ON settings(notebook_id, key);
    CREATE INDEX IF NOT EXISTS idx_status_events_notebook_task_id ON task_status_events(notebook_id, task_id);
    CREATE INDEX IF NOT EXISTS idx_due_date_events_notebook_task_id ON task_due_date_events(notebook_id, task_id);
  `)),E}function o(e){return{id:e.id,name:e.name,createdAt:e.created_at,updatedAt:e.updated_at,lastAccessedAt:e.last_accessed_at}}function T(e){let t=i().prepare("SELECT * FROM notebooks WHERE id = ?").get(e);return t?o(t):null}function d(){let e=i().prepare("SELECT * FROM notebooks ORDER BY last_accessed_at DESC, id ASC LIMIT 1").get();return e?o(e):N("MAIN")}function N(e){let t=new Date().toISOString(),s=_(e)||"UNTITLED",a=Number(i().prepare(`
    INSERT INTO notebooks (name, created_at, updated_at, last_accessed_at)
    VALUES (?, ?, ?, ?)
  `).run(s,t,t,t).lastInsertRowid);return function(e,t){if(i().prepare("SELECT value FROM settings WHERE notebook_id = ? AND key = ?").get(e,"tags"))return;let s=i().prepare(`
    INSERT OR IGNORE INTO settings (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
  `);s.run(e,"tags",JSON.stringify(["Frontend","Backend","Design","Bug","Feature"]),t),s.run(e,"assistantIntents",JSON.stringify([]),t)}(a,t),T(a)}function _(e){return e.trim().replace(/\s+/g," ").slice(0,80)}e.s(["DB_FILE",0,r,"getDb",0,i],47029),e.s(["activateNotebook",0,function(e){if(!T(e))throw Error("Notebook not found");let t=new Date().toISOString();return i().prepare("UPDATE notebooks SET last_accessed_at = ?, updated_at = ? WHERE id = ?").run(t,t,e),T(e)},"createNotebook",0,N,"deleteNotebook",0,function(e){if(!T(e))throw Error("Notebook not found");let t=i();return t.transaction(()=>{t.prepare("DELETE FROM task_due_date_events WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM task_status_events WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)").run(e),t.prepare("DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)").run(e),t.prepare("DELETE FROM tasks WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM settings WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM notebooks WHERE id = ?").run(e)})(),d()||N("MAIN")},"getActiveNotebook",0,d,"listNotebooks",0,function(){return i().prepare("SELECT * FROM notebooks ORDER BY last_accessed_at DESC, name ASC").all().map(o)},"renameNotebook",0,function(e,t){if(!T(e))throw Error("Notebook not found");let s=_(t);if(!s)throw Error("Notebook name is required");let a=new Date().toISOString();return i().prepare("UPDATE notebooks SET name = ?, updated_at = ? WHERE id = ?").run(s,a,e),T(e)},"resolveNotebookId",0,function(e){let t=Number(e);return Number.isInteger(t)&&t>0&&T(t)?t:d().id}],13547)},45136,e=>{"use strict";var t=e.i(22734),s=e.i(14747),a=e.i(47029),n=e.i(13547);let r=s.default.join(process.cwd(),"data","settings.json"),E={geminiApiKey:"",tags:["Frontend","Backend","Design","Bug","Feature"],assistantIntents:[{id:"tasks-tag-alm",label:"Tag ALM",question:"Các công việc liên quan tới tag ALM là gì?",intent:"TASKS_BY_TAG",tag:"ALM",enabled:!0},{id:"due-3-days",label:"Due in 3 days",question:"Tôi có task nào tới hạn trong 3 ngày?",intent:"DUE_WITHIN_DAYS",days:3,enabled:!0},{id:"avg-completion",label:"Average completion",question:"Thời gian trung bình hoàn thành task là bao lâu?",intent:"AVERAGE_COMPLETION_TIME",enabled:!0}]};async function i(e){let s=(0,n.resolveNotebookId)(e);!function(e){let s=(0,a.getDb)().prepare("SELECT COUNT(*) AS count FROM settings WHERE notebook_id IN (0, ?)").get(e);if((s?.count||0)>0)return;let n=E;if(t.default.existsSync(r)){let e=function(e){try{let t=JSON.parse(e);if(!t||"object"!=typeof t)return{};return{geminiApiKey:"string"==typeof t.geminiApiKey?t.geminiApiKey:void 0,tags:Array.isArray(t.tags)?t.tags.filter(e=>"string"==typeof e):void 0,assistantIntents:Array.isArray(t.assistantIntents)?d(t.assistantIntents):void 0}}catch{return{}}}(t.default.readFileSync(r,"utf-8"));n={...E,...e,tags:Array.isArray(e.tags)?e.tags:E.tags}}T(n,e)}(s);let i=new Map((0,a.getDb)().prepare("SELECT key, value FROM settings WHERE notebook_id IN (0, ?)").all(s).map(e=>[e.key,e.value])),o={geminiApiKey:i.get("geminiApiKey")||E.geminiApiKey,tags:function(e){if(!e)return E.tags;try{let t=JSON.parse(e);if(!Array.isArray(t))return E.tags;return t.filter(e=>"string"==typeof e)}catch{return E.tags}}(i.get("tags")),assistantIntents:function(e){if(!e)return E.assistantIntents;try{let t=JSON.parse(e);if(!Array.isArray(t))return E.assistantIntents;let s=d(t);return s.length>0?s:E.assistantIntents}catch{return E.assistantIntents}}(i.get("assistantIntents"))};return i.has("assistantIntents")&&i.has("tags")||T(o,s),o}async function o(e,t){T(e,(0,n.resolveNotebookId)(t))}function T(e,t){let s=new Date().toISOString(),n=(0,a.getDb)().prepare(`
    INSERT INTO settings (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(notebook_id, key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);(0,a.getDb)().transaction(()=>{n.run(0,"geminiApiKey",e.geminiApiKey||"",s),n.run(t,"tags",JSON.stringify(e.tags||[]),s),n.run(t,"assistantIntents",JSON.stringify(d(e.assistantIntents)),s)})()}function d(e){return Array.isArray(e)?e.map((e,t)=>{var s,a;let n=e&&"object"==typeof e?e:{},r="string"==typeof(s=n.intent)&&["TASKS_BY_TAG","DUE_WITHIN_DAYS","STATUS_TASKS","AVERAGE_COMPLETION_TIME","COMPLETED_IN_PERIOD","UNFINISHED_BY_TAG","OVERDUE_TASKS","SEARCH_TASKS","UNKNOWN"].includes(s)?s:void 0,E="string"==typeof n.question?n.question.trim().slice(0,255):"";return r&&E?{id:"string"==typeof n.id&&n.id.trim()?n.id:`assistant-intent-${t+1}`,label:"string"==typeof n.label&&n.label.trim()?n.label.trim().slice(0,80):E.slice(0,80),question:E,intent:r,enabled:!1!==n.enabled,tag:"string"==typeof n.tag?n.tag.trim():void 0,days:"number"==typeof n.days&&Number.isFinite(n.days)?Math.max(0,Math.min(365,Math.trunc(n.days))):void 0,status:"string"==typeof(a=n.status)&&["URGENT","IN PROGRESS","TO DO","PENDING","CANCELLED","DONE"].includes(a)?a:void 0,query:"string"==typeof n.query?n.query.trim().slice(0,255):void 0,period:"week"===n.period||"month"===n.period||"all"===n.period?n.period:void 0}:null}).filter(e=>null!==e):[]}e.s(["readSettings",0,i,"writeSettings",0,o])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0mme-kj._.js.map