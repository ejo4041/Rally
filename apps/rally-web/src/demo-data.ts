export const turns = [
 {speaker:'Alex', text:'The release checklist is complete, except for the mobile sign-in regression.'},
 {speaker:'Priya', text:'I will fix the mobile sign-in regression by Tuesday.'},
 {speaker:'Sam', text:'Could someone update the launch checklist? We have not agreed who will own that.'},
 {speaker:'Rally', text:'The regression has an owner and a Tuesday target. The checklist owner is still unconfirmed. Is launch conditional on the regression passing?'},
 {speaker:'Alex', text:'Yes. We agree to launch only after the mobile regression passes. We have not chosen a launch date.'},
 {speaker:'Sam', text:'Agreed. Keep the launch date open, and leave the checklist owner unassigned.'},
 {speaker:'Rally', text:'Confirmed: launch depends on the regression passing. Priya owns the fix, due Tuesday. Checklist ownership and the launch date remain open.'},
] as const;
export type Approach = 'passive'|'balanced'|'proactive';
export function visibleTurn(index:number, approach:Approach){return turns[index].speaker!=='Rally'||approach!=='passive';}
export const outcomes = [
 {title:'Decision · conditional launch',text:'Launch only after the mobile regression passes. Launch date: not agreed.',evidence:[4,5]},
 {title:'Action · fix mobile sign-in',text:'Owner: Priya. Due: Tuesday (relative date, not normalized to a calendar date).',evidence:[1]},
 {title:'Open · launch checklist',text:'Owner: unconfirmed. Due date: unknown. No assignment was inferred.',evidence:[2,5]},
];
export function initialReplay(){return {cursor:0, playing:false};}
export function advance(cursor:number){return Math.min(turns.length,cursor+1);}
export function makeExport(agenda:string,note:string,labels:Record<string,string>){return {kind:'rally-synthetic-sample',provenance:'Authored fictional example. No live model calls or meeting recording.',agenda,transcript:turns.map((t,i)=>({...t,speaker:labels[t.speaker]||t.speaker,id:i+1})),outcomes,hostNote:note};}
