module.exports=[18622,(e,t,a)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,a)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},14747,(e,t,a)=>{t.exports=e.x("path",()=>require("path"))},93695,(e,t,a)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},22734,(e,t,a)=>{t.exports=e.x("fs",()=>require("fs"))},85148,(e,t,a)=>{t.exports=e.x("better-sqlite3-90e2652d1716b047",()=>require("better-sqlite3-90e2652d1716b047"))},13547,47029,e=>{"use strict";var t=e.i(22734),a=e.i(14747),r=e.i(85148);let s=a.default.join(process.cwd(),"data"),o=a.default.join(s,"task-manager.db"),n=null;function i(){var e;let a,i;return n||(t.default.mkdirSync(s,{recursive:!0}),(n=new r.default(o)).pragma("foreign_keys = ON"),n.pragma("journal_mode = WAL"),(e=n).exec(`
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
  `).run("MAIN",a,a,a).lastInsertRowid)}(e),(i=e.prepare("PRAGMA table_info(tasks)").all()).some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE tasks ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${a}`).run(),i.some(e=>"sort_order"===e.name)||e.prepare("ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0").run(),i.some(e=>"progress"===e.name)||e.prepare("ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0").run(),e.prepare("PRAGMA table_info(subtasks)").all().some(e=>"sort_order"===e.name)||e.prepare("ALTER TABLE subtasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0").run(),function(e,t){let a=e.prepare("PRAGMA table_info(settings)").all(),r=a.some(e=>"notebook_id"===e.name),s=a.find(e=>"key"===e.name),o=a.find(e=>"notebook_id"===e.name),n=!!(s?.pk&&o?.pk);if(r&&n)return;e.exec(`
    CREATE TABLE IF NOT EXISTS settings_next (
      notebook_id INTEGER NOT NULL DEFAULT 0,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (notebook_id, key)
    );
  `);let i=e.prepare(r?"SELECT notebook_id, key, value, updated_at FROM settings":"SELECT key, value, updated_at FROM settings").all(),E=e.prepare(`
    INSERT OR REPLACE INTO settings_next (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
  `);for(let e of i){let a="geminiApiKey"===e.key?0:e.notebook_id||t;E.run(a,e.key,e.value,e.updated_at)}e.exec(`
    DROP TABLE settings;
    ALTER TABLE settings_next RENAME TO settings;
  `)}(e,a),e.prepare("PRAGMA table_info(task_status_events)").all().some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE task_status_events ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${a}`).run(),e.prepare("PRAGMA table_info(task_due_date_events)").all().some(e=>"notebook_id"===e.name)||e.prepare(`ALTER TABLE task_due_date_events ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${a}`).run(),e.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_notebook_id ON tasks(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status_sort_order ON tasks(status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_sort_order ON subtasks(task_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_settings_notebook_key ON settings(notebook_id, key);
    CREATE INDEX IF NOT EXISTS idx_status_events_notebook_task_id ON task_status_events(notebook_id, task_id);
    CREATE INDEX IF NOT EXISTS idx_due_date_events_notebook_task_id ON task_due_date_events(notebook_id, task_id);
  `)),n}function E(e){return{id:e.id,name:e.name,createdAt:e.created_at,updatedAt:e.updated_at,lastAccessedAt:e.last_accessed_at}}function d(e){let t=i().prepare("SELECT * FROM notebooks WHERE id = ?").get(e);return t?E(t):null}function T(){let e=i().prepare("SELECT * FROM notebooks ORDER BY last_accessed_at DESC, id ASC LIMIT 1").get();return e?E(e):u("MAIN")}function u(e){let t=new Date().toISOString(),a=l(e)||"UNTITLED",r=Number(i().prepare(`
    INSERT INTO notebooks (name, created_at, updated_at, last_accessed_at)
    VALUES (?, ?, ?, ?)
  `).run(a,t,t,t).lastInsertRowid);return function(e,t){if(i().prepare("SELECT value FROM settings WHERE notebook_id = ? AND key = ?").get(e,"tags"))return;let a=i().prepare(`
    INSERT OR IGNORE INTO settings (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
  `);a.run(e,"tags",JSON.stringify(["Frontend","Backend","Design","Bug","Feature"]),t),a.run(e,"assistantIntents",JSON.stringify([]),t)}(r,t),d(r)}function l(e){return e.trim().replace(/\s+/g," ").slice(0,80)}e.s(["DB_FILE",0,o,"getDb",0,i],47029),e.s(["activateNotebook",0,function(e){if(!d(e))throw Error("Notebook not found");let t=new Date().toISOString();return i().prepare("UPDATE notebooks SET last_accessed_at = ?, updated_at = ? WHERE id = ?").run(t,t,e),d(e)},"createNotebook",0,u,"deleteNotebook",0,function(e){if(!d(e))throw Error("Notebook not found");let t=i();return t.transaction(()=>{t.prepare("DELETE FROM task_due_date_events WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM task_status_events WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)").run(e),t.prepare("DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)").run(e),t.prepare("DELETE FROM tasks WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM settings WHERE notebook_id = ?").run(e),t.prepare("DELETE FROM notebooks WHERE id = ?").run(e)})(),T()||u("MAIN")},"getActiveNotebook",0,T,"listNotebooks",0,function(){return i().prepare("SELECT * FROM notebooks ORDER BY last_accessed_at DESC, name ASC").all().map(E)},"renameNotebook",0,function(e,t){if(!d(e))throw Error("Notebook not found");let a=l(t);if(!a)throw Error("Notebook name is required");let r=new Date().toISOString();return i().prepare("UPDATE notebooks SET name = ?, updated_at = ? WHERE id = ?").run(a,r,e),d(e)},"resolveNotebookId",0,function(e){let t=Number(e);return Number.isInteger(t)&&t>0&&d(t)?t:T().id}],13547)},61692,e=>{"use strict";var t=e.i(47909),a=e.i(74017),r=e.i(96250),s=e.i(59756),o=e.i(61916),n=e.i(74677),i=e.i(69741),E=e.i(16795),d=e.i(70996),T=e.i(95169),u=e.i(47587),l=e.i(66012),N=e.i(70101),p=e.i(26937),_=e.i(10372),R=e.i(93695);e.i(52474);var c=e.i(220),k=e.i(94028),L=e.i(13547);async function O(e,t){try{let{id:e}=await t.params,a=(0,L.activateNotebook)(Number(e));return k.NextResponse.json({activeNotebook:a,notebooks:(0,L.listNotebooks)()})}catch(e){return console.error("Failed to activate notebook:",e),k.NextResponse.json({error:e instanceof Error?e.message:"Failed to activate notebook"},{status:400})}}e.s(["POST",0,O,"runtime",0,"nodejs"],57556);var A=e.i(57556);let I=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/notebooks/[id]/activate/route",pathname:"/api/notebooks/[id]/activate",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/notebooks/[id]/activate/route.ts",nextConfigOutput:"standalone",userland:A,...{}}),{workAsyncStorage:b,workUnitAsyncStorage:S,serverHooks:g}=I;async function v(e,t,r){r.requestMeta&&(0,s.setRequestMeta)(e,r.requestMeta),I.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let k="/api/notebooks/[id]/activate/route";k=k.replace(/\/index$/,"")||"/";let L=await I.prepare(e,t,{srcPage:k,multiZoneDraftMode:!1});if(!L)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:O,deploymentId:A,params:b,nextConfig:S,parsedUrl:g,isDraftMode:v,prerenderManifest:C,routerServerContext:x,isOnDemandRevalidate:U,revalidateOnlyGenerated:f,resolvedPathname:D,clientReferenceManifest:m,serverActionsManifest:h}=L,F=(0,i.normalizeAppPath)(k),X=!!(C.dynamicRoutes[F]||C.routes[D]),M=async()=>((null==x?void 0:x.render404)?await x.render404(e,t,g,!1):t.end("This page could not be found"),null);if(X&&!v){let e=!!C.routes[D],t=C.dynamicRoutes[F];if(t&&!1===t.fallback&&!e){if(S.adapterPath)return await M();throw new R.NoFallbackError}}let w=null;!X||I.isDev||v||(w="/index"===(w=D)?"/":w);let y=!0===I.isDev||!X,P=X&&!y;h&&m&&(0,n.setManifestsSingleton)({page:k,clientReferenceManifest:m,serverActionsManifest:h});let G=e.method||"GET",q=(0,o.getTracer)(),H=q.getActiveScopeSpan(),B=!!(null==x?void 0:x.isWrappedByNextServer),j=!!(0,s.getRequestMeta)(e,"minimalMode"),Y=(0,s.getRequestMeta)(e,"incrementalCache")||await I.getIncrementalCache(e,S,C,j);null==Y||Y.resetRequestCache(),globalThis.__incrementalCache=Y;let K={params:b,previewProps:C.preview,renderOpts:{experimental:{authInterrupts:!!S.experimental.authInterrupts},cacheComponents:!!S.cacheComponents,supportsDynamicResponse:y,incrementalCache:Y,cacheLifeProfiles:S.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,r,s)=>I.onRequestError(e,t,r,s,x)},sharedContext:{buildId:O,deploymentId:A}},W=new E.NodeNextRequest(e),$=new E.NodeNextResponse(t),V=d.NextRequestAdapter.fromNodeNextRequest(W,(0,d.signalFromNodeResponse)(t));try{let s,n=async e=>I.handle(V,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=q.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==T.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=a.get("next.route");if(r){let t=`${G} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",r),s.updateName(t))}else e.updateName(`${G} ${k}`)}),i=async s=>{var o,i;let E=async({previousCacheEntry:a})=>{try{if(!j&&U&&f&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let o=await n(s);e.fetchMetrics=K.renderOpts.fetchMetrics;let i=K.renderOpts.pendingWaitUntil;i&&r.waitUntil&&(r.waitUntil(i),i=void 0);let E=K.renderOpts.collectedTags;if(!X)return await (0,l.sendResponse)(W,$,o,K.renderOpts.pendingWaitUntil),null;{let e=await o.blob(),t=(0,N.toNodeOutgoingHttpHeaders)(o.headers);E&&(t[_.NEXT_CACHE_TAGS_HEADER]=E),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=_.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,r=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=_.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:c.CachedRouteKind.APP_ROUTE,status:o.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:r}}}}catch(t){throw(null==a?void 0:a.isStale)&&await I.onRequestError(e,t,{routerKind:"App Router",routePath:k,routeType:"route",revalidateReason:(0,u.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:U})},!1,x),t}},d=await I.handleResponse({req:e,nextConfig:S,cacheKey:w,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:U,revalidateOnlyGenerated:f,responseGenerator:E,waitUntil:r.waitUntil,isMinimalMode:j});if(!X)return null;if((null==d||null==(o=d.value)?void 0:o.kind)!==c.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(i=d.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});j||t.setHeader("x-nextjs-cache",U?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),v&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let T=(0,N.fromNodeOutgoingHttpHeaders)(d.value.headers);return j&&X||T.delete(_.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||T.get("Cache-Control")||T.set("Cache-Control",(0,p.getCacheControlHeader)(d.cacheControl)),await (0,l.sendResponse)(W,$,new Response(d.value.body,{headers:T,status:d.value.status||200})),null};B&&H?await i(H):(s=q.getActiveScopeSpan(),await q.withPropagatedContext(e.headers,()=>q.trace(T.BaseServerSpan.handleRequest,{spanName:`${G} ${k}`,kind:o.SpanKind.SERVER,attributes:{"http.method":G,"http.target":e.url}},i),void 0,!B))}catch(t){if(t instanceof R.NoFallbackError||await I.onRequestError(e,t,{routerKind:"App Router",routePath:F,routeType:"route",revalidateReason:(0,u.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:U})},!1,x),X)throw t;return await (0,l.sendResponse)(W,$,new Response(null,{status:500})),null}}e.s(["handler",0,v,"patchFetch",0,function(){return(0,r.patchFetch)({workAsyncStorage:b,workUnitAsyncStorage:S})},"routeModule",0,I,"serverHooks",0,g,"workAsyncStorage",0,b,"workUnitAsyncStorage",0,S],61692)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0oyu-pu._.js.map