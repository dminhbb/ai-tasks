module.exports=[18622,(e,t,a)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,a)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},14747,(e,t,a)=>{t.exports=e.x("path",()=>require("path"))},93695,(e,t,a)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},22734,(e,t,a)=>{t.exports=e.x("fs",()=>require("fs"))},85148,(e,t,a)=>{t.exports=e.x("better-sqlite3-90e2652d1716b047",()=>require("better-sqlite3-90e2652d1716b047"))},13547,47029,e=>{"use strict";var t=e.i(22734),a=e.i(14747),n=e.i(85148);let s=a.default.join(process.cwd(),"data"),r=a.default.join(s,"task-manager.db"),i=null;function o(){var e;let a,o;return i||(t.default.mkdirSync(s,{recursive:!0}),(i=new n.default(r)).pragma("foreign_keys = ON"),i.pragma("journal_mode = WAL"),(e=i).exec(`
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
  `),a=function(e){let t=e.prepare("SELECT id FROM notebooks ORDER BY last_accessed_at DESC, id ASC LIMIT 1").get();if(t)return t.id;let a=new Date().toISOString();return Number(e.prepare(`
    INSERT INTO notebooks (name, created_at, updated_at, last_accessed_at)
    VALUES (?, ?, ?, ?)
  `).run("MAIN",a,a,a).lastInsertRowid)}(e),(o=e.prepare("PRAGMA table_info(tasks)").all()).some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE tasks ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${a}`).run(),o.some(e=>"sort_order"===e.name)||e.prepare("ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0").run(),o.some(e=>"progress"===e.name)||e.prepare("ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0").run(),e.prepare("PRAGMA table_info(subtasks)").all().some(e=>"sort_order"===e.name)||e.prepare("ALTER TABLE subtasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0").run(),function(e,t){let a=e.prepare("PRAGMA table_info(settings)").all(),n=a.some(e=>"notebook_id"===e.name),s=a.find(e=>"key"===e.name),r=a.find(e=>"notebook_id"===e.name),i=!!(s?.pk&&r?.pk);if(n&&i)return;e.exec(`
    CREATE TABLE IF NOT EXISTS settings_next (
      notebook_id INTEGER NOT NULL DEFAULT 0,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (notebook_id, key)
    );
  `);let o=e.prepare(n?"SELECT notebook_id, key, value, updated_at FROM settings":"SELECT key, value, updated_at FROM settings").all(),d=e.prepare(`
    INSERT OR REPLACE INTO settings_next (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
  `);for(let e of o){let a="geminiApiKey"===e.key?0:e.notebook_id||t;d.run(a,e.key,e.value,e.updated_at)}e.exec(`
    DROP TABLE settings;
    ALTER TABLE settings_next RENAME TO settings;
  `)}(e,a),e.prepare("PRAGMA table_info(task_status_events)").all().some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE task_status_events ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${a}`).run(),e.prepare("PRAGMA table_info(task_due_date_events)").all().some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE task_due_date_events ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${a}`).run(),e.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_notebook_id ON tasks(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status_sort_order ON tasks(status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_sort_order ON subtasks(task_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_settings_notebook_key ON settings(notebook_id, key);
    CREATE INDEX IF NOT EXISTS idx_status_events_notebook_task_id ON task_status_events(notebook_id, task_id);
    CREATE INDEX IF NOT EXISTS idx_due_date_events_notebook_task_id ON task_due_date_events(notebook_id, task_id);
  `)),i}function d(e){return{id:e.id,name:e.name,createdAt:e.created_at,updatedAt:e.updated_at,lastAccessedAt:e.last_accessed_at}}function E(e){let t=o().prepare("SELECT * FROM notebooks WHERE id = ?").get(e);return t?d(t):null}function u(){let e=o().prepare("SELECT * FROM notebooks ORDER BY last_accessed_at DESC, id ASC LIMIT 1").get();return e?d(e):l("MAIN")}function l(e){let t=new Date().toISOString(),a=T(e)||"UNTITLED",n=Number(o().prepare(`
    INSERT INTO notebooks (name, created_at, updated_at, last_accessed_at)
    VALUES (?, ?, ?, ?)
  `).run(a,t,t,t).lastInsertRowid);return function(e,t){if(o().prepare("SELECT value FROM settings WHERE notebook_id = ? AND key = ?").get(e,"tags"))return;let a=o().prepare(`
    INSERT OR IGNORE INTO settings (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
  `);a.run(e,"tags",JSON.stringify(["Frontend","Backend","Design","Bug","Feature"]),t),a.run(e,"assistantIntents",JSON.stringify([]),t)}(n,t),E(n)}function T(e){return e.trim().replace(/\s+/g," ").slice(0,80)}e.s(["DB_FILE",0,r,"getDb",0,o],47029),e.s(["activateNotebook",0,function(e){if(!E(e))throw Error("Notebook not found");let t=new Date().toISOString();return o().prepare("UPDATE notebooks SET last_accessed_at = ?, updated_at = ? WHERE id = ?").run(t,t,e),E(e)},"createNotebook",0,l,"deleteNotebook",0,function(e){if(!E(e))throw Error("Notebook not found");let t=o();return t.transaction(()=>{t.prepare("DELETE FROM task_due_date_events WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM task_status_events WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)").run(e),t.prepare("DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)").run(e),t.prepare("DELETE FROM tasks WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM settings WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM notebooks WHERE id = ?").run(e)})(),u()||l("MAIN")},"getActiveNotebook",0,u,"listNotebooks",0,function(){return o().prepare("SELECT * FROM notebooks ORDER BY last_accessed_at DESC, name ASC").all().map(d)},"renameNotebook",0,function(e,t){if(!E(e))throw Error("Notebook not found");let a=T(t);if(!a)throw Error("Notebook name is required");let n=new Date().toISOString();return o().prepare("UPDATE notebooks SET name = ?, updated_at = ? WHERE id = ?").run(a,n,e),E(e)},"resolveNotebookId",0,function(e){let t=Number(e);return Number.isInteger(t)&&t>0&&E(t)?t:u().id}],13547)},45136,e=>{"use strict";var t=e.i(22734),a=e.i(14747),n=e.i(47029),s=e.i(13547);let r=a.default.join(process.cwd(),"data","settings.json"),i={geminiApiKey:"",tags:["Frontend","Backend","Design","Bug","Feature"],assistantIntents:[{id:"tasks-tag-alm",label:"Tag ALM",question:"Các công việc liên quan tới tag ALM là gì?",intent:"TASKS_BY_TAG",tag:"ALM",enabled:!0},{id:"due-3-days",label:"Due in 3 days",question:"Tôi có task nào tới hạn trong 3 ngày?",intent:"DUE_WITHIN_DAYS",days:3,enabled:!0},{id:"avg-completion",label:"Average completion",question:"Thời gian trung bình hoàn thành task là bao lâu?",intent:"AVERAGE_COMPLETION_TIME",enabled:!0}]};async function o(e){let a=(0,s.resolveNotebookId)(e);!function(e){let a=(0,n.getDb)().prepare("SELECT COUNT(*) AS count FROM settings WHERE notebook_id IN (0, ?)").get(e);if((a?.count||0)>0)return;let s=i;if(t.default.existsSync(r)){let e=function(e){try{let t=JSON.parse(e);if(!t||"object"!=typeof t)return{};return{geminiApiKey:"string"==typeof t.geminiApiKey?t.geminiApiKey:void 0,tags:Array.isArray(t.tags)?t.tags.filter(e=>"string"==typeof e):void 0,assistantIntents:Array.isArray(t.assistantIntents)?u(t.assistantIntents):void 0}}catch{return{}}}(t.default.readFileSync(r,"utf-8"));s={...i,...e,tags:Array.isArray(e.tags)?e.tags:i.tags}}E(s,e)}(a);let o=new Map((0,n.getDb)().prepare("SELECT key, value FROM settings WHERE notebook_id IN (0, ?)").all(a).map(e=>[e.key,e.value])),d={geminiApiKey:o.get("geminiApiKey")||i.geminiApiKey,tags:function(e){if(!e)return i.tags;try{let t=JSON.parse(e);if(!Array.isArray(t))return i.tags;return t.filter(e=>"string"==typeof e)}catch{return i.tags}}(o.get("tags")),assistantIntents:function(e){if(!e)return i.assistantIntents;try{let t=JSON.parse(e);if(!Array.isArray(t))return i.assistantIntents;let a=u(t);return a.length>0?a:i.assistantIntents}catch{return i.assistantIntents}}(o.get("assistantIntents"))};return o.has("assistantIntents")&&o.has("tags")||E(d,a),d}async function d(e,t){E(e,(0,s.resolveNotebookId)(t))}function E(e,t){let a=new Date().toISOString(),s=(0,n.getDb)().prepare(`
    INSERT INTO settings (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(notebook_id, key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);(0,n.getDb)().transaction(()=>{s.run(0,"geminiApiKey",e.geminiApiKey||"",a),s.run(t,"tags",JSON.stringify(e.tags||[]),a),s.run(t,"assistantIntents",JSON.stringify(u(e.assistantIntents)),a)})()}function u(e){return Array.isArray(e)?e.map((e,t)=>{var a,n;let s=e&&"object"==typeof e?e:{},r="string"==typeof(a=s.intent)&&["TASKS_BY_TAG","DUE_WITHIN_DAYS","STATUS_TASKS","AVERAGE_COMPLETION_TIME","COMPLETED_IN_PERIOD","UNFINISHED_BY_TAG","OVERDUE_TASKS","SEARCH_TASKS","UNKNOWN"].includes(a)?a:void 0,i="string"==typeof s.question?s.question.trim().slice(0,255):"";return r&&i?{id:"string"==typeof s.id&&s.id.trim()?s.id:`assistant-intent-${t+1}`,label:"string"==typeof s.label&&s.label.trim()?s.label.trim().slice(0,80):i.slice(0,80),question:i,intent:r,enabled:!1!==s.enabled,tag:"string"==typeof s.tag?s.tag.trim():void 0,days:"number"==typeof s.days&&Number.isFinite(s.days)?Math.max(0,Math.min(365,Math.trunc(s.days))):void 0,status:"string"==typeof(n=s.status)&&["URGENT","IN PROGRESS","TO DO","PENDING","CANCELLED","DONE"].includes(n)?n:void 0,query:"string"==typeof s.query?s.query.trim().slice(0,255):void 0,period:"week"===s.period||"month"===s.period||"all"===s.period?s.period:void 0}:null}).filter(e=>null!==e):[]}e.s(["readSettings",0,o,"writeSettings",0,d])},5508,e=>{"use strict";var t=e.i(47909),a=e.i(74017),n=e.i(96250),s=e.i(59756),r=e.i(61916),i=e.i(74677),o=e.i(69741),d=e.i(16795),E=e.i(70996),u=e.i(95169),l=e.i(47587),T=e.i(66012),p=e.i(70101),N=e.i(26937),c=e.i(10372),_=e.i(93695);e.i(52474);var g=e.i(220),R=e.i(94028),A=e.i(29642),k=e.i(45136),I=e.i(43747);async function O(e){try{let{text:t}=await e.json();if(!t)return R.NextResponse.json({error:"Text is required"},{status:400});let a=await (0,k.readSettings)();if(!a.geminiApiKey)return R.NextResponse.json({error:"Gemini API Key is not configured in Settings"},{status:400});let n=new A.GoogleGenerativeAI(a.geminiApiKey).getGenerativeModel({model:"gemini-flash-latest"}),s=new Date,r=(0,I.format)(s,"yyyy-MM-dd'T'HH:mm:ss"),i=`
Bạn l\xe0 một trợ l\xfd ảo gi\xfap b\xf3c t\xe1ch th\xf4ng tin c\xf4ng việc từ văn bản tự do.
Văn bản đầu v\xe0o c\xf3 thể chứa một hoặc NHIỀU c\xf4ng việc.
Văn bản đầu v\xe0o: "${t}"

Thời gian hiện tại l\xe0: ${r}

H\xe3y ph\xe2n t\xedch v\xe0 trả về CHỈ MỘT MẢNG JSON (kh\xf4ng c\xf3 markdown \`\`\`json) chứa danh s\xe1ch c\xe1c c\xf4ng việc. Định dạng ch\xednh x\xe1c của mảng như sau, kh\xf4ng c\xf3 bất kỳ text n\xe0o kh\xe1c:
[
  {
    "createdAt": "thời gian hiện tại hoặc được nhắc tới (ISO format YYYY-MM-DDTHH:mm:ss)",
    "title": "Ti\xeau đề c\xf4ng việc ngắn gọn (tối đa 50 k\xfd tự)",
    "details": "Chi tiết c\xf4ng việc",
    "assignee": "T\xean người được giao việc nếu c\xf3, nếu kh\xf4ng th\xec để trống",
    "startDate": "Ng\xe0y bắt đầu nếu c\xf3 (ISO format YYYY-MM-DDTHH:mm:ss), nếu kh\xf4ng để null",
    "dueDate": "Hạn ch\xf3t nếu c\xf3 (ISO format YYYY-MM-DDTHH:mm:ss), nếu kh\xf4ng để null",
    "notes": "C\xe1c ghi ch\xfa li\xean quan kh\xe1c"
  }
]
Lưu \xfd: Nếu người d\xf9ng d\xf9ng c\xe1c từ như "ng\xe0y mai", "tuần sau", h\xe3y dựa v\xe0o thời gian hiện tại để t\xednh to\xe1n ng\xe0y cho startDate hoặc dueDate. Đảm bảo trả về MẢNG [] kể cả khi chỉ c\xf3 1 c\xf4ng việc.
`,o=await n.generateContent(i),d=(await o.response).text().trim();d.startsWith("```json")&&(d=d.substring(7)),d.startsWith("```")&&(d=d.substring(3)),d.endsWith("```")&&(d=d.substring(0,d.length-3));let E=JSON.parse(d.trim());return R.NextResponse.json(E)}catch(e){var t;return console.error("Extraction error:",e),R.NextResponse.json({error:((t=e)instanceof Error?t.message:"")||"Failed to extract task data"},{status:500})}}e.s(["POST",0,O,"runtime",0,"nodejs"],96494);var L=e.i(96494);let x=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/extract-task/route",pathname:"/api/extract-task",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/extract-task/route.ts",nextConfigOutput:"standalone",userland:L,...{}}),{workAsyncStorage:f,workUnitAsyncStorage:S,serverHooks:b}=x;async function h(e,t,n){n.requestMeta&&(0,s.setRequestMeta)(e,n.requestMeta),x.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let R="/api/extract-task/route";R=R.replace(/\/index$/,"")||"/";let A=await x.prepare(e,t,{srcPage:R,multiZoneDraftMode:!1});if(!A)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:k,deploymentId:I,params:O,nextConfig:L,parsedUrl:f,isDraftMode:S,prerenderManifest:b,routerServerContext:h,isOnDemandRevalidate:m,revalidateOnlyGenerated:v,resolvedPathname:y,clientReferenceManifest:D,serverActionsManifest:C}=A,U=(0,o.normalizeAppPath)(R),M=!!(b.dynamicRoutes[U]||b.routes[y]),F=async()=>((null==h?void 0:h.render404)?await h.render404(e,t,f,!1):t.end("This page could not be found"),null);if(M&&!S){let e=!!b.routes[y],t=b.dynamicRoutes[U];if(t&&!1===t.fallback&&!e){if(L.adapterPath)return await F();throw new _.NoFallbackError}}let X=null;!M||x.isDev||S||(X="/index"===(X=y)?"/":X);let w=!0===x.isDev||!M,G=M&&!w;C&&D&&(0,i.setManifestsSingleton)({page:R,clientReferenceManifest:D,serverActionsManifest:C});let P=e.method||"GET",H=(0,r.getTracer)(),q=H.getActiveScopeSpan(),Y=!!(null==h?void 0:h.isWrappedByNextServer),K=!!(0,s.getRequestMeta)(e,"minimalMode"),B=(0,s.getRequestMeta)(e,"incrementalCache")||await x.getIncrementalCache(e,L,b,K);null==B||B.resetRequestCache(),globalThis.__incrementalCache=B;let j={params:O,previewProps:b.preview,renderOpts:{experimental:{authInterrupts:!!L.experimental.authInterrupts},cacheComponents:!!L.cacheComponents,supportsDynamicResponse:w,incrementalCache:B,cacheLifeProfiles:L.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,n,s)=>x.onRequestError(e,t,n,s,h)},sharedContext:{buildId:k,deploymentId:I}},W=new d.NodeNextRequest(e),$=new d.NodeNextResponse(t),V=E.NextRequestAdapter.fromNodeNextRequest(W,(0,E.signalFromNodeResponse)(t));try{let s,i=async e=>x.handle(V,j).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=H.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=a.get("next.route");if(n){let t=`${P} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",n),s.updateName(t))}else e.updateName(`${P} ${R}`)}),o=async s=>{var r,o;let d=async({previousCacheEntry:a})=>{try{if(!K&&m&&v&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let r=await i(s);e.fetchMetrics=j.renderOpts.fetchMetrics;let o=j.renderOpts.pendingWaitUntil;o&&n.waitUntil&&(n.waitUntil(o),o=void 0);let d=j.renderOpts.collectedTags;if(!M)return await (0,T.sendResponse)(W,$,r,j.renderOpts.pendingWaitUntil),null;{let e=await r.blob(),t=(0,p.toNodeOutgoingHttpHeaders)(r.headers);d&&(t[c.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==j.renderOpts.collectedRevalidate&&!(j.renderOpts.collectedRevalidate>=c.INFINITE_CACHE)&&j.renderOpts.collectedRevalidate,n=void 0===j.renderOpts.collectedExpire||j.renderOpts.collectedExpire>=c.INFINITE_CACHE?void 0:j.renderOpts.collectedExpire;return{value:{kind:g.CachedRouteKind.APP_ROUTE,status:r.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:n}}}}catch(t){throw(null==a?void 0:a.isStale)&&await x.onRequestError(e,t,{routerKind:"App Router",routePath:R,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:G,isOnDemandRevalidate:m})},!1,h),t}},E=await x.handleResponse({req:e,nextConfig:L,cacheKey:X,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:b,isRoutePPREnabled:!1,isOnDemandRevalidate:m,revalidateOnlyGenerated:v,responseGenerator:d,waitUntil:n.waitUntil,isMinimalMode:K});if(!M)return null;if((null==E||null==(r=E.value)?void 0:r.kind)!==g.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==E||null==(o=E.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});K||t.setHeader("x-nextjs-cache",m?"REVALIDATED":E.isMiss?"MISS":E.isStale?"STALE":"HIT"),S&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,p.fromNodeOutgoingHttpHeaders)(E.value.headers);return K&&M||u.delete(c.NEXT_CACHE_TAGS_HEADER),!E.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,N.getCacheControlHeader)(E.cacheControl)),await (0,T.sendResponse)(W,$,new Response(E.value.body,{headers:u,status:E.value.status||200})),null};Y&&q?await o(q):(s=H.getActiveScopeSpan(),await H.withPropagatedContext(e.headers,()=>H.trace(u.BaseServerSpan.handleRequest,{spanName:`${P} ${R}`,kind:r.SpanKind.SERVER,attributes:{"http.method":P,"http.target":e.url}},o),void 0,!Y))}catch(t){if(t instanceof _.NoFallbackError||await x.onRequestError(e,t,{routerKind:"App Router",routePath:U,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:G,isOnDemandRevalidate:m})},!1,h),M)throw t;return await (0,T.sendResponse)(W,$,new Response(null,{status:500})),null}}e.s(["handler",0,h,"patchFetch",0,function(){return(0,n.patchFetch)({workAsyncStorage:f,workUnitAsyncStorage:S})},"routeModule",0,x,"serverHooks",0,b,"workAsyncStorage",0,f,"workUnitAsyncStorage",0,S],5508)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0hojg0u._.js.map