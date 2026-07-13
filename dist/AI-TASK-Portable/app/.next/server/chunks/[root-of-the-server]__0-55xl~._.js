module.exports=[18622,(e,t,a)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,a)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},14747,(e,t,a)=>{t.exports=e.x("path",()=>require("path"))},93695,(e,t,a)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},22734,(e,t,a)=>{t.exports=e.x("fs",()=>require("fs"))},85148,(e,t,a)=>{t.exports=e.x("better-sqlite3-90e2652d1716b047",()=>require("better-sqlite3-90e2652d1716b047"))},13547,47029,e=>{"use strict";var t=e.i(22734),a=e.i(14747),s=e.i(85148);let r=a.default.join(process.cwd(),"data"),n=a.default.join(r,"task-manager.db"),o=null;function i(){var e;let a,i;return o||(t.default.mkdirSync(r,{recursive:!0}),(o=new s.default(n)).pragma("foreign_keys = ON"),o.pragma("journal_mode = WAL"),(e=o).exec(`
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
  `).run("MAIN",a,a,a).lastInsertRowid)}(e),(i=e.prepare("PRAGMA table_info(tasks)").all()).some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE tasks ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${a}`).run(),i.some(e=>"sort_order"===e.name)||e.prepare("ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0").run(),i.some(e=>"progress"===e.name)||e.prepare("ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0").run(),e.prepare("PRAGMA table_info(subtasks)").all().some(e=>"sort_order"===e.name)||e.prepare("ALTER TABLE subtasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0").run(),function(e,t){let a=e.prepare("PRAGMA table_info(settings)").all(),s=a.some(e=>"notebook_id"===e.name),r=a.find(e=>"key"===e.name),n=a.find(e=>"notebook_id"===e.name),o=!!(r?.pk&&n?.pk);if(s&&o)return;e.exec(`
    CREATE TABLE IF NOT EXISTS settings_next (
      notebook_id INTEGER NOT NULL DEFAULT 0,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (notebook_id, key)
    );
  `);let i=e.prepare(s?"SELECT notebook_id, key, value, updated_at FROM settings":"SELECT key, value, updated_at FROM settings").all(),d=e.prepare(`
    INSERT OR REPLACE INTO settings_next (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
  `);for(let e of i){let a="geminiApiKey"===e.key?0:e.notebook_id||t;d.run(a,e.key,e.value,e.updated_at)}e.exec(`
    DROP TABLE settings;
    ALTER TABLE settings_next RENAME TO settings;
  `)}(e,a),e.prepare("PRAGMA table_info(task_status_events)").all().some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE task_status_events ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${a}`).run(),e.prepare("PRAGMA table_info(task_due_date_events)").all().some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE task_due_date_events ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${a}`).run(),e.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_notebook_id ON tasks(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status_sort_order ON tasks(status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_sort_order ON subtasks(task_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_settings_notebook_key ON settings(notebook_id, key);
    CREATE INDEX IF NOT EXISTS idx_status_events_notebook_task_id ON task_status_events(notebook_id, task_id);
    CREATE INDEX IF NOT EXISTS idx_due_date_events_notebook_task_id ON task_due_date_events(notebook_id, task_id);
  `)),o}function d(e){return{id:e.id,name:e.name,createdAt:e.created_at,updatedAt:e.updated_at,lastAccessedAt:e.last_accessed_at}}function E(e){let t=i().prepare("SELECT * FROM notebooks WHERE id = ?").get(e);return t?d(t):null}function u(){let e=i().prepare("SELECT * FROM notebooks ORDER BY last_accessed_at DESC, id ASC LIMIT 1").get();return e?d(e):l("MAIN")}function l(e){let t=new Date().toISOString(),a=T(e)||"UNTITLED",s=Number(i().prepare(`
    INSERT INTO notebooks (name, created_at, updated_at, last_accessed_at)
    VALUES (?, ?, ?, ?)
  `).run(a,t,t,t).lastInsertRowid);return function(e,t){if(i().prepare("SELECT value FROM settings WHERE notebook_id = ? AND key = ?").get(e,"tags"))return;let a=i().prepare(`
    INSERT OR IGNORE INTO settings (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
  `);a.run(e,"tags",JSON.stringify(["Frontend","Backend","Design","Bug","Feature"]),t),a.run(e,"assistantIntents",JSON.stringify([]),t)}(s,t),E(s)}function T(e){return e.trim().replace(/\s+/g," ").slice(0,80)}e.s(["DB_FILE",0,n,"getDb",0,i],47029),e.s(["activateNotebook",0,function(e){if(!E(e))throw Error("Notebook not found");let t=new Date().toISOString();return i().prepare("UPDATE notebooks SET last_accessed_at = ?, updated_at = ? WHERE id = ?").run(t,t,e),E(e)},"createNotebook",0,l,"deleteNotebook",0,function(e){if(!E(e))throw Error("Notebook not found");let t=i();return t.transaction(()=>{t.prepare("DELETE FROM task_due_date_events WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM task_status_events WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)").run(e),t.prepare("DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)").run(e),t.prepare("DELETE FROM tasks WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM settings WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM notebooks WHERE id = ?").run(e)})(),u()||l("MAIN")},"getActiveNotebook",0,u,"listNotebooks",0,function(){return i().prepare("SELECT * FROM notebooks ORDER BY last_accessed_at DESC, name ASC").all().map(d)},"renameNotebook",0,function(e,t){if(!E(e))throw Error("Notebook not found");let a=T(t);if(!a)throw Error("Notebook name is required");let s=new Date().toISOString();return i().prepare("UPDATE notebooks SET name = ?, updated_at = ? WHERE id = ?").run(a,s,e),E(e)},"resolveNotebookId",0,function(e){let t=Number(e);return Number.isInteger(t)&&t>0&&E(t)?t:u().id}],13547)},45136,e=>{"use strict";var t=e.i(22734),a=e.i(14747),s=e.i(47029),r=e.i(13547);let n=a.default.join(process.cwd(),"data","settings.json"),o={geminiApiKey:"",tags:["Frontend","Backend","Design","Bug","Feature"],assistantIntents:[{id:"tasks-tag-alm",label:"Tag ALM",question:"Các công việc liên quan tới tag ALM là gì?",intent:"TASKS_BY_TAG",tag:"ALM",enabled:!0},{id:"due-3-days",label:"Due in 3 days",question:"Tôi có task nào tới hạn trong 3 ngày?",intent:"DUE_WITHIN_DAYS",days:3,enabled:!0},{id:"avg-completion",label:"Average completion",question:"Thời gian trung bình hoàn thành task là bao lâu?",intent:"AVERAGE_COMPLETION_TIME",enabled:!0}]};async function i(e){let a=(0,r.resolveNotebookId)(e);!function(e){let a=(0,s.getDb)().prepare("SELECT COUNT(*) AS count FROM settings WHERE notebook_id IN (0, ?)").get(e);if((a?.count||0)>0)return;let r=o;if(t.default.existsSync(n)){let e=function(e){try{let t=JSON.parse(e);if(!t||"object"!=typeof t)return{};return{geminiApiKey:"string"==typeof t.geminiApiKey?t.geminiApiKey:void 0,tags:Array.isArray(t.tags)?t.tags.filter(e=>"string"==typeof e):void 0,assistantIntents:Array.isArray(t.assistantIntents)?u(t.assistantIntents):void 0}}catch{return{}}}(t.default.readFileSync(n,"utf-8"));r={...o,...e,tags:Array.isArray(e.tags)?e.tags:o.tags}}E(r,e)}(a);let i=new Map((0,s.getDb)().prepare("SELECT key, value FROM settings WHERE notebook_id IN (0, ?)").all(a).map(e=>[e.key,e.value])),d={geminiApiKey:i.get("geminiApiKey")||o.geminiApiKey,tags:function(e){if(!e)return o.tags;try{let t=JSON.parse(e);if(!Array.isArray(t))return o.tags;return t.filter(e=>"string"==typeof e)}catch{return o.tags}}(i.get("tags")),assistantIntents:function(e){if(!e)return o.assistantIntents;try{let t=JSON.parse(e);if(!Array.isArray(t))return o.assistantIntents;let a=u(t);return a.length>0?a:o.assistantIntents}catch{return o.assistantIntents}}(i.get("assistantIntents"))};return i.has("assistantIntents")&&i.has("tags")||E(d,a),d}async function d(e,t){E(e,(0,r.resolveNotebookId)(t))}function E(e,t){let a=new Date().toISOString(),r=(0,s.getDb)().prepare(`
    INSERT INTO settings (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(notebook_id, key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);(0,s.getDb)().transaction(()=>{r.run(0,"geminiApiKey",e.geminiApiKey||"",a),r.run(t,"tags",JSON.stringify(e.tags||[]),a),r.run(t,"assistantIntents",JSON.stringify(u(e.assistantIntents)),a)})()}function u(e){return Array.isArray(e)?e.map((e,t)=>{var a,s;let r=e&&"object"==typeof e?e:{},n="string"==typeof(a=r.intent)&&["TASKS_BY_TAG","DUE_WITHIN_DAYS","STATUS_TASKS","AVERAGE_COMPLETION_TIME","COMPLETED_IN_PERIOD","UNFINISHED_BY_TAG","OVERDUE_TASKS","SEARCH_TASKS","UNKNOWN"].includes(a)?a:void 0,o="string"==typeof r.question?r.question.trim().slice(0,255):"";return n&&o?{id:"string"==typeof r.id&&r.id.trim()?r.id:`assistant-intent-${t+1}`,label:"string"==typeof r.label&&r.label.trim()?r.label.trim().slice(0,80):o.slice(0,80),question:o,intent:n,enabled:!1!==r.enabled,tag:"string"==typeof r.tag?r.tag.trim():void 0,days:"number"==typeof r.days&&Number.isFinite(r.days)?Math.max(0,Math.min(365,Math.trunc(r.days))):void 0,status:"string"==typeof(s=r.status)&&["URGENT","IN PROGRESS","TO DO","PENDING","CANCELLED","DONE"].includes(s)?s:void 0,query:"string"==typeof r.query?r.query.trim().slice(0,255):void 0,period:"week"===r.period||"month"===r.period||"all"===r.period?r.period:void 0}:null}).filter(e=>null!==e):[]}e.s(["readSettings",0,i,"writeSettings",0,d])},61525,e=>{"use strict";var t=e.i(47909),a=e.i(74017),s=e.i(96250),r=e.i(59756),n=e.i(61916),o=e.i(74677),i=e.i(69741),d=e.i(16795),E=e.i(70996),u=e.i(95169),l=e.i(47587),T=e.i(66012),p=e.i(70101),N=e.i(26937),_=e.i(10372),c=e.i(93695);e.i(52474);var R=e.i(220),A=e.i(94028),g=e.i(45136),k=e.i(13547);async function I(e){try{let t=(0,k.resolveNotebookId)(e.nextUrl.searchParams.get("notebookId")),a=await (0,g.readSettings)(t);return A.NextResponse.json(a)}catch(e){return console.error("Failed to read settings:",e),A.NextResponse.json({error:"Failed to read settings"},{status:500})}}async function O(e){try{let t=await e.json(),a=(0,k.resolveNotebookId)(e.nextUrl.searchParams.get("notebookId"));return await (0,g.writeSettings)(t,a),A.NextResponse.json({success:!0})}catch(e){return console.error("Failed to write settings:",e),A.NextResponse.json({error:"Failed to write settings"},{status:500})}}e.s(["GET",0,I,"POST",0,O,"runtime",0,"nodejs"],36189);var L=e.i(36189);let S=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/settings/route",pathname:"/api/settings",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/settings/route.ts",nextConfigOutput:"standalone",userland:L,...{}}),{workAsyncStorage:b,workUnitAsyncStorage:f,serverHooks:v}=S;async function y(e,t,s){s.requestMeta&&(0,r.setRequestMeta)(e,s.requestMeta),S.isDev&&(0,r.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let A="/api/settings/route";A=A.replace(/\/index$/,"")||"/";let g=await S.prepare(e,t,{srcPage:A,multiZoneDraftMode:!1});if(!g)return t.statusCode=400,t.end("Bad Request"),null==s.waitUntil||s.waitUntil.call(s,Promise.resolve()),null;let{buildId:k,deploymentId:I,params:O,nextConfig:L,parsedUrl:b,isDraftMode:f,prerenderManifest:v,routerServerContext:y,isOnDemandRevalidate:m,revalidateOnlyGenerated:D,resolvedPathname:C,clientReferenceManifest:x,serverActionsManifest:U}=g,h=(0,i.normalizeAppPath)(A),F=!!(v.dynamicRoutes[h]||v.routes[C]),M=async()=>((null==y?void 0:y.render404)?await y.render404(e,t,b,!1):t.end("This page could not be found"),null);if(F&&!f){let e=!!v.routes[C],t=v.dynamicRoutes[h];if(t&&!1===t.fallback&&!e){if(L.adapterPath)return await M();throw new c.NoFallbackError}}let X=null;!F||S.isDev||f||(X="/index"===(X=C)?"/":X);let w=!0===S.isDev||!F,P=F&&!w;U&&x&&(0,o.setManifestsSingleton)({page:A,clientReferenceManifest:x,serverActionsManifest:U});let G=e.method||"GET",q=(0,n.getTracer)(),H=q.getActiveScopeSpan(),K=!!(null==y?void 0:y.isWrappedByNextServer),B=!!(0,r.getRequestMeta)(e,"minimalMode"),j=(0,r.getRequestMeta)(e,"incrementalCache")||await S.getIncrementalCache(e,L,v,B);null==j||j.resetRequestCache(),globalThis.__incrementalCache=j;let Y={params:O,previewProps:v.preview,renderOpts:{experimental:{authInterrupts:!!L.experimental.authInterrupts},cacheComponents:!!L.cacheComponents,supportsDynamicResponse:w,incrementalCache:j,cacheLifeProfiles:L.cacheLife,waitUntil:s.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,s,r)=>S.onRequestError(e,t,s,r,y)},sharedContext:{buildId:k,deploymentId:I}},W=new d.NodeNextRequest(e),$=new d.NodeNextResponse(t),V=E.NextRequestAdapter.fromNodeNextRequest(W,(0,E.signalFromNodeResponse)(t));try{let r,o=async e=>S.handle(V,Y).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=q.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let s=a.get("next.route");if(s){let t=`${G} ${s}`;e.setAttributes({"next.route":s,"http.route":s,"next.span_name":t}),e.updateName(t),r&&r!==e&&(r.setAttribute("http.route",s),r.updateName(t))}else e.updateName(`${G} ${A}`)}),i=async r=>{var n,i;let d=async({previousCacheEntry:a})=>{try{if(!B&&m&&D&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await o(r);e.fetchMetrics=Y.renderOpts.fetchMetrics;let i=Y.renderOpts.pendingWaitUntil;i&&s.waitUntil&&(s.waitUntil(i),i=void 0);let d=Y.renderOpts.collectedTags;if(!F)return await (0,T.sendResponse)(W,$,n,Y.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,p.toNodeOutgoingHttpHeaders)(n.headers);d&&(t[_.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==Y.renderOpts.collectedRevalidate&&!(Y.renderOpts.collectedRevalidate>=_.INFINITE_CACHE)&&Y.renderOpts.collectedRevalidate,s=void 0===Y.renderOpts.collectedExpire||Y.renderOpts.collectedExpire>=_.INFINITE_CACHE?void 0:Y.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:s}}}}catch(t){throw(null==a?void 0:a.isStale)&&await S.onRequestError(e,t,{routerKind:"App Router",routePath:A,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:m})},!1,y),t}},E=await S.handleResponse({req:e,nextConfig:L,cacheKey:X,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:v,isRoutePPREnabled:!1,isOnDemandRevalidate:m,revalidateOnlyGenerated:D,responseGenerator:d,waitUntil:s.waitUntil,isMinimalMode:B});if(!F)return null;if((null==E||null==(n=E.value)?void 0:n.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==E||null==(i=E.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",m?"REVALIDATED":E.isMiss?"MISS":E.isStale?"STALE":"HIT"),f&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,p.fromNodeOutgoingHttpHeaders)(E.value.headers);return B&&F||u.delete(_.NEXT_CACHE_TAGS_HEADER),!E.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,N.getCacheControlHeader)(E.cacheControl)),await (0,T.sendResponse)(W,$,new Response(E.value.body,{headers:u,status:E.value.status||200})),null};K&&H?await i(H):(r=q.getActiveScopeSpan(),await q.withPropagatedContext(e.headers,()=>q.trace(u.BaseServerSpan.handleRequest,{spanName:`${G} ${A}`,kind:n.SpanKind.SERVER,attributes:{"http.method":G,"http.target":e.url}},i),void 0,!K))}catch(t){if(t instanceof c.NoFallbackError||await S.onRequestError(e,t,{routerKind:"App Router",routePath:h,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:m})},!1,y),F)throw t;return await (0,T.sendResponse)(W,$,new Response(null,{status:500})),null}}e.s(["handler",0,y,"patchFetch",0,function(){return(0,s.patchFetch)({workAsyncStorage:b,workUnitAsyncStorage:f})},"routeModule",0,S,"serverHooks",0,v,"workAsyncStorage",0,b,"workUnitAsyncStorage",0,f],61525)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0-55xl~._.js.map