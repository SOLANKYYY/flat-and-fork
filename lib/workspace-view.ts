// View-only filters. Authorization remains with the API and mutation model.
export function filterTasks<T extends {assignee?:string;done?:unknown}>(tasks:T[],scope:string,userId:string):T[]{
 return tasks.filter(t=>scope==='mine'?t.assignee===userId:scope==='pending'?!t.done:scope==='done'?!!t.done:true);
}
export function filterMembers<T extends {name:string;role?:string;awayDate?:string}>(members:T[],query:string,scope:string,today:string):T[]{
 const term=query.trim().toLocaleLowerCase();
 return members.filter(m=>m.name.toLocaleLowerCase().includes(term)&&(scope==='home'?m.awayDate!==today:scope==='away'?m.awayDate===today:scope==='residents'?m.role!=='cook':scope==='cooks'?m.role==='cook':true));
}
export function filterRequests<T extends {status:string}>(requests:T[],scope:string):T[]{return requests.filter(r=>scope==='all'||r.status===scope)}
