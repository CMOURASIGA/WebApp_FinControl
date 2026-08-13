import type { Session, User } from '@supabase/supabase-js';
import { DEFAULT_BRAND } from './brand';

type Row = Record<string, any>;
type Store = Record<string, Row[]>;
const STORE_KEY = '7finance.demo.database.v1';
const SESSION_KEY = '7finance.demo.session.v1';
export const DEMO_ACK_KEY = '7finance.demo.aviso.confirmado.v1';
const USER_ID = 'demo-user-admin';
const now = () => new Date().toISOString();
const day = (d = 10) => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; };
const id = (p='demo') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

function seed(): Store {
  const socio='demo-socio-1', cliente='demo-cliente-1', projeto='demo-projeto-1', recorrente='demo-projeto-2', regra='demo-regra-1', tributo='demo-tributo-1';
  const base={created_by:USER_ID,created_at:now(),updated_at:now()};
  return {
    profiles:[{id:USER_ID,nome:'Visitante da demonstração',cpf:null,chave_pix:null,papel:'admin',ativo:true,created_at:now(),updated_at:now()}],
    socios:[{...base,id:socio,profile_id:null,nome:'Sócio Demonstrativo',cpf:null,chave_pix:null,email:'socio@empresa-exemplo.com.br',telefone:null,tipo:'socio',data_entrada:day(1),data_saida:null,ativo:true}],
    clientes:[{id:cliente,nome:'Empresa Exemplo',documento:null,contato:'contato@empresa-exemplo.com.br',observacao:'Cliente fictício',created_at:now(),updated_at:now()}],
    projetos:[
      {...base,id:projeto,cliente_id:cliente,nome:'Implantação Plataforma',tipo:'implantacao',origem_economica:'Venda direta',responsavel_comercial:null,responsavel_execucao:null,originador_socio_id:socio,responsavel_comercial_socio_id:socio,responsavel_execucao_socio_id:socio,status:'ativo',observacao:'Projeto fictício'},
      {...base,id:recorrente,cliente_id:cliente,nome:'Suporte Mensal',tipo:'recorrente',origem_economica:'Contrato recorrente',responsavel_comercial:null,responsavel_execucao:null,originador_socio_id:socio,responsavel_comercial_socio_id:socio,responsavel_execucao_socio_id:socio,status:'ativo',observacao:'Projeto fictício'}],
    parametros_tributarios:[{id:tributo,aliquota_percentual:6,regime:'Simples Nacional',tipo_receita:'geral',vigencia_inicio:`${day().slice(0,4)}-01-01`,vigencia_fim:null,observacao:'Parâmetro demonstrativo',created_by:USER_ID,created_at:now()}],
    regras_distribuicao:[{id:regra,escopo:'default',projeto_id:null,percentual_empresa:30,split_socios:[{socio_id:socio,percentual:70}],vigencia_inicio:`${day().slice(0,4)}-01-01`,vigencia_fim:null,observacao:'Regra demonstrativa',created_by:USER_ID,created_at:now()}],
    receitas:[
      {...base,id:'demo-receita-1',projeto_id:projeto,descricao:'Parcela da implantação',tipo:'pontual',valor_bruto:6000,status:'recebido',data_prevista:day(5),data_fato_gerador:day(5),data_recebimento:day(7),parametro_tributario_id:tributo,aliquota_aplicada:6,regra_distribuicao_id:regra,percentual_empresa_aplicado:30,split_socios_aplicado:[{socio_id:socio,percentual:70}],tributo_status:'provisionado',tributo_pago_em:null,observacao:null,receita_origem_id:null,emite_nota:true,tem_retencao:false,percentual_retencao:0,valor_retido:0},
      {...base,id:'demo-receita-2',projeto_id:recorrente,descricao:'Mensalidade de suporte',tipo:'recorrente',valor_bruto:1100,status:'previsto',data_prevista:day(20),data_fato_gerador:day(10),data_recebimento:null,parametro_tributario_id:tributo,aliquota_aplicada:6,regra_distribuicao_id:regra,percentual_empresa_aplicado:30,split_socios_aplicado:[{socio_id:socio,percentual:70}],tributo_status:'provisionado',tributo_pago_em:null,observacao:null,receita_origem_id:null,emite_nota:true,tem_retencao:false,percentual_retencao:0,valor_retido:0}],
    custos_projeto:[{...base,id:'demo-custo-1',projeto_id:projeto,descricao:'Serviço técnico terceirizado',categoria:'Prestador',valor:900,data:day(8),observacao:null,status:'pago',data_pagamento:day(8)}],
    despesas:[{...base,id:'demo-despesa-1',categoria:'Software',tipo:'fixa',descricao:'Ferramentas da empresa',valor:249,projeto_id:null,competencia:day(1),data_vencimento:day(15),data_pagamento:null,status:'provisionado',observacao:'Despesa fictícia'}],
    investimentos:[],assinaturas:[],socio_lancamentos:[],reserva_empresa_lancamentos:[],fechamentos_mensais:[],receita_historico:[],financeiro_historico:[],
    white_label_settings:[{...DEFAULT_BRAND,id:true,updated_at:now()}]
  };
}
function read():Store { const raw=localStorage.getItem(STORE_KEY); if(raw) try{return JSON.parse(raw)}catch{} const s=seed(); write(s); return s; }
function write(s:Store){localStorage.setItem(STORE_KEY,JSON.stringify(s));}
export function resetDemoData(){write(seed());window.location.reload();}

class Query {
  private filters:Array<(r:Row)=>boolean>=[]; private sorting?:{field:string,asc:boolean}; private op:'select'|'insert'|'update'='select'; private payload:any; private one=false;
  constructor(private table:string){}
  select(_='*'){return this;} insert(v:any){this.op='insert';this.payload=v;return this;} update(v:any){this.op='update';this.payload=v;return this;}
  eq(f:string,v:any){this.filters.push(r=>r[f]===v);return this;} is(f:string,v:any){return this.eq(f,v);} gte(f:string,v:any){this.filters.push(r=>r[f]>=v);return this;} lte(f:string,v:any){this.filters.push(r=>r[f]<=v);return this;}
  order(field:string,o?:{ascending?:boolean}){this.sorting={field,asc:o?.ascending!==false};return this;} single(){this.one=true;return this.run();} maybeSingle(){this.one=true;return this.run();}
  then(ok:(v:any)=>void,bad?:(e:any)=>void){return this.run().then(ok,bad);}
  private async run(){const s=read(),rows=s[this.table]??[],match=(r:Row)=>this.filters.every(f=>f(r));let out:Row[];
    if(this.op==='insert'){out=(Array.isArray(this.payload)?this.payload:[this.payload]).map((r:Row)=>({id:r.id??id(this.table),created_at:r.created_at??now(),updated_at:r.updated_at??now(),...r}));s[this.table]=[...rows,...out];write(s);}
    else if(this.op==='update'){s[this.table]=rows.map(r=>match(r)?{...r,...this.payload,updated_at:now()}:r);out=s[this.table].filter(match);write(s);} else out=rows.filter(match).map(r=>({...r}));
    if(this.sorting)out.sort((a,b)=>String(a[this.sorting!.field]??'').localeCompare(String(b[this.sorting!.field]??''))*(this.sorting!.asc?1:-1));return{data:this.one?(out[0]??null):out,error:null};}
}

function hist(s:Store,entidade:string,row:Row,before:Row,acao:string,motivo?:string){const common={id:id('hist'),acao,dados_anteriores:before,dados_novos:{...row},motivo:motivo??null,executado_por:USER_ID,executado_em:now()}; if(entidade==='receita')s.receita_historico.push({...common,receita_id:row.id});else s.financeiro_historico.push({...common,entidade,registro_id:row.id});}
async function rpc(name:string,p:Row){const s=read(),find=(t:string,i:string)=>(s[t]??[]).find(r=>r.id===i);let returned:any=null;
  if(name==='alterar_status_receita'){const r=find('receitas',p.p_receita_id);if(r){const b={...r},map:Row={receber:'recebido',cancelar:'cancelado',estornar_recebimento:'previsto',reativar:'previsto'};r.status=map[p.p_acao];r.data_recebimento=p.p_acao==='receber'?p.p_data:null;hist(s,'receita',r,b,p.p_acao,p.p_motivo);}}
  else if(name==='editar_receita'){const r=find('receitas',p.p_receita_id);if(r){const b={...r};Object.assign(r,{descricao:p.p_descricao,tipo:p.p_tipo,valor_bruto:p.p_valor_bruto,data_prevista:p.p_data_prevista,data_fato_gerador:p.p_data_fato_gerador,parametro_tributario_id:p.p_parametro_tributario_id,aliquota_aplicada:p.p_aliquota_aplicada,regra_distribuicao_id:p.p_regra_distribuicao_id,percentual_empresa_aplicado:p.p_percentual_empresa_aplicado,split_socios_aplicado:p.p_split_socios_aplicado,emite_nota:p.p_emite_nota,tem_retencao:p.p_tem_retencao,percentual_retencao:p.p_percentual_retencao,valor_retido:p.p_tem_retencao?+(p.p_valor_bruto*p.p_percentual_retencao/100).toFixed(2):0});hist(s,'receita',r,b,'edicao',p.p_motivo);}}
  else if(name==='editar_custo_projeto'||name==='editar_despesa'){const cost=name.includes('custo'),t=cost?'custos_projeto':'despesas',r=find(t,p.p_id);if(r){const b={...r};Object.assign(r,cost?{descricao:p.p_descricao,categoria:p.p_categoria,valor:p.p_valor,data:p.p_data}:{categoria:p.p_categoria,tipo:p.p_tipo,descricao:p.p_descricao,valor:p.p_valor,projeto_id:p.p_projeto_id,competencia:p.p_competencia,data_vencimento:p.p_data_vencimento});hist(s,cost?'custo_projeto':'despesa',r,b,'edicao',p.p_motivo);}}
  else if(name==='alterar_status_custo'||name==='alterar_status_despesa'){const cost=name.includes('custo'),t=cost?'custos_projeto':'despesas',r=find(t,p.p_id);if(r){const b={...r},map:Row={pagar:'pago',estornar:'provisionado',cancelar:'cancelado',reativar:'provisionado'};r.status=map[p.p_acao];r.data_pagamento=p.p_acao==='pagar'?p.p_data:null;hist(s,cost?'custo_projeto':'despesa',r,b,p.p_acao,p.p_motivo);}}
  else if(name==='registrar_retirada_socio'){returned={id:id('retirada'),socio_id:p.p_socio_id,tipo:'retirada',valor:p.p_valor,projeto_id:null,receita_id:null,fechamento_id:null,data:p.p_data,descricao:p.p_descricao,created_by:USER_ID,created_at:now()};s.socio_lancamentos.push(returned);}
  else if(name==='fechar_mes'){returned={id:id('fechamento'),competencia:p.p_competencia,status:'fechado',fechado_em:now(),fechado_por:USER_ID,snapshot:p.p_snapshot,observacao:p.p_observacao,created_at:now()};s.fechamentos_mensais.push(returned);(p.p_creditos??[]).forEach((c:Row)=>s.socio_lancamentos.push({id:id('credito'),socio_id:c.socio_id,tipo:c.valor>=0?'credito_resultado':'debito_ajuste',valor:Math.abs(c.valor),projeto_id:null,receita_id:null,fechamento_id:returned.id,data:p.p_competencia,descricao:'Resultado demonstrativo',created_by:USER_ID,created_at:now()}));}
  else if(name==='corrigir_receita_fechada'){const r=find('receitas',p.p_receita_id);if(r){const b={...r};r.valor_bruto=p.p_valor_correto;hist(s,'receita',r,b,'ajuste_fechado',p.p_motivo);}}
  write(s);return{data:returned,error:null};
}
const listeners=new Set<(e:string,s:Session|null)=>void>();
function session():Session{const user={id:USER_ID,email:'demo@7finance.app',app_metadata:{},user_metadata:{nome:'Visitante da demonstração'},aud:'authenticated',created_at:now()} as User;return{access_token:'demo-local',refresh_token:'demo-local',expires_in:31536000,token_type:'bearer',user} as Session;}
export const demoSupabase:any={from:(t:string)=>new Query(t),rpc,auth:{getSession:async()=>({data:{session:localStorage.getItem(SESSION_KEY)?session():null}}),signInWithPassword:async()=>{const s=session();localStorage.setItem(SESSION_KEY,'active');listeners.forEach(l=>l('SIGNED_IN',s));return{data:{session:s},error:null};},signUp:async()=>({data:{user:session().user},error:null}),signOut:async()=>{localStorage.removeItem(SESSION_KEY);listeners.forEach(l=>l('SIGNED_OUT',null));return{error:null};},onAuthStateChange:(cb:any)=>{listeners.add(cb);return{data:{subscription:{unsubscribe:()=>listeners.delete(cb)}}};}},storage:{from:()=>({upload:async(_p:string,file:File)=>{const url=await new Promise<string>((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>bad(r.error);r.readAsDataURL(file);});localStorage.setItem('7finance.demo.logo.v1',url);return{data:{path:'demo-logo'},error:null};},getPublicUrl:()=>({data:{publicUrl:localStorage.getItem('7finance.demo.logo.v1')??DEFAULT_BRAND.logo_url}})})}};
