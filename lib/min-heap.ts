export class MinHeap<T extends {f:number}>{
 private a:T[]=[];
 get length(){return this.a.length;}
 push(v:T){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}
 pop(){const a=this.a,first=a[0],last=a.pop()!;if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&a[child+1].f<a[child].f)child++;if(last.f<=a[child].f)break;a[i]=a[child];i=child;}a[i]=last;}return first;}
}
