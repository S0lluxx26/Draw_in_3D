package com.drawin3d;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Random;

/** Procedural sheets and surface paint. No camera, simulation loop or bitmap files. */
final class Paper {
    static final String[] KINDS={"watercolor","rough","sketch","canvas","coated"};
    static final String[] NAMES={"Watercolor · cold press","Watercolor · rough","Sketch paper","Woven canvas","Coated · water resistant"};
    static final int[] TINT={0xfff1e6d1,0xffe9dcc3,0xfff5eedf,0xffe7d8b8,0xffe4edf0};
    static final float[] SPREAD={1.35f,1.6f,1,1.08f,.92f},OPACITY={.72f,.64f,.95f,.9f,.94f},GRAIN={.55f,.85f,.22f,.6f,.08f};
    static int kind(String name){return Arrays.asList(KINDS).indexOf(name);}
    static float[][] basis(float[] normal){
        float[] n=Math3.norm(normal),u=Math3.norm(Math3.cross(Math.abs(n[1])>.95f?new float[]{0,0,-1}:new float[]{0,1,0},n));
        return new float[][]{u,Math3.cross(n,u),n};
    }
    static float[] world(SceneData.Entity e,float[] p){return Math3.add(e.position,Math3.rotateY(Math3.mul(p,e.scale),e.yaw));}
    static float[] coordinates(SceneData.Entity e,float[] world){
        return Surface.coordinates(e,world);
    }
    static boolean inside(SceneData.Entity e,float[] p){float[] uv=coordinates(e,p);return Math.abs(uv[0])<=e.panelWidth/2&&Math.abs(uv[1])<=e.panelWidth/e.aspect/2;}
    static int[] pixels(String kind,boolean ink){
        int k=kind(kind);int[] pixels=new int[256*256];
        for(int y=0;y<256;y++)for(int x=0;x<256;x++){
            int h=(x*374761393)^(y*668265263);h=(h^(h>>>13))*1274126177;h^=h>>>16;
            double n=(h&0xffffffffL)/4294967295.0;
            if(k==3)n=Math.min(1,n*.3+(x%8<2||y%8<2?.1:.7));
            if(k==2)n=.55+n*.35+(y%17==0?-.25:0);if(k==4)n=.88+n*.12;
            double shade=1-GRAIN[k]*(1-n)*.2;
            int r=ink?255:(int)Math.round(((TINT[k]>>16)&255)*shade),g=ink?255:(int)Math.round(((TINT[k]>>8)&255)*shade),b=ink?255:(int)Math.round((TINT[k]&255)*shade);
            int a=ink?(int)Math.round(255*(1-GRAIN[k]*(1-n)*.85)):255;pixels[y*256+x]=(a<<24)|(r<<16)|(g<<8)|b;
        }return pixels;
    }
    static Geometry sheet(SceneData.Entity e){
        Geometry m=new Geometry();float w=e.panelWidth,h=w/e.aspect;float[] c={1,1,1,1},zero={0,0,0};int steps=Math.max(1,(int)Math.ceil(Math.abs(e.bend)/3));
        for(int i=0;i<steps;i++)for(float[] uv:new float[][]{{i/(float)steps,0},{i/(float)steps,1},{(i+1f)/steps,0},{(i+1f)/steps,0},{i/(float)steps,1},{(i+1f)/steps,1}})m.vertex(Surface.bend(e,new float[]{(uv[0]-.5f)*w,(.5f-uv[1])*h},0),c,uv[0],uv[1],zero);return m;
    }
    static Geometry ink(SceneData.Entity e,SceneData.Entity paper){return new Ink(e,paper).build();}
    private static final class Ink {
        final Geometry m=new Geometry();final SceneData.Entity e,paper;final float[][] axes;final float[] color;final int kind;final boolean wash;final Random rng;
        Ink(SceneData.Entity e,SceneData.Entity paper){this.e=e;this.paper=paper;axes=Surface.axes(paper);kind=kind(paper.paperKind);wash=e.brush.equals("Water")||e.wet;rng=new Random(e.id.hashCode());color=Geometry.color(e.color,e.alpha*(wash?OPACITY[kind]:1)*(e.brush.equals("Marker")?.55f:1));}
        void vertex(float[] p,float alpha,float[] fall){
            m.vertex(Surface.bend(paper,p,.003f/paper.scale),new float[]{color[0],color[1],color[2],color[3]*alpha},.5f+(p[0]+fall[0])/paper.panelWidth,.5f-(p[1]+fall[1])/(paper.panelWidth/paper.aspect),new float[]{fall[0],fall[1],0});
        }
        void ribbon(float[] a,float[] b,float r,float[] fall){
            float dx=b[0]-a[0]+fall[0],dy=b[1]-a[1]+fall[1],length=(float)Math.hypot(dx,dy);if(length<1e-8f)return;
            float sx=-dy/length*r,sy=dx/length*r;float[] stops=wash?new float[]{-1,-.65f,.65f,1}:new float[]{-1,-.9f,.9f,1},opacity={0,1,1,0},zero={0,0};
            int steps=Math.min(100,Math.max(1,(int)Math.ceil(Math.abs(fall[0]*paper.bend/paper.panelWidth)/3)));
            for(int j=0;j<steps;j++)for(int i=0;i<3;i++){float[] fa={fall[0]*j/steps,fall[1]*j/steps},fb={fall[0]*(j+1)/steps,fall[1]*(j+1)/steps};
                float[] a0={a[0]+sx*stops[i],a[1]+sy*stops[i]},a1={a[0]+sx*stops[i+1],a[1]+sy*stops[i+1]},b0={b[0]+sx*stops[i],b[1]+sy*stops[i]},b1={b[0]+sx*stops[i+1],b[1]+sy*stops[i+1]};
                vertex(a0,opacity[i],fa);vertex(b0,opacity[i],fb);vertex(a1,opacity[i+1],fa);vertex(a1,opacity[i+1],fa);vertex(b0,opacity[i],fb);vertex(b1,opacity[i+1],fb);
            }
        }
        void stamp(float[] p,float r){float[] zero={0,0};for(int j=0;j<12;j++){double a=j*Math.PI/6,b=(j+1)*Math.PI/6;vertex(p,1,zero);vertex(new float[]{p[0]+(float)Math.cos(a)*r,p[1]+(float)Math.sin(a)*r},0,zero);vertex(new float[]{p[0]+(float)Math.cos(b)*r,p[1]+(float)Math.sin(b)*r},0,zero);}}
        Geometry build(){
            ArrayList<float[]> all=new ArrayList<>();float[] zero={0,0};
            for(ArrayList<float[]> path:Surface.paths(e,paper)){
                all.addAll(path);
                for(int i=0;i<path.size();i++){float[] p=path.get(i);float r=e.width*.5f*p[2]*e.scale/(e.pointSpace.equals("surface")?1:paper.scale)*(wash?SPREAD[kind]:1)*(e.brush.equals("Marker")?1.8f:1);
                    if(e.brush.equals("Spray")){for(int j=0;j<3;j++)stamp(new float[]{p[0]+(rng.nextFloat()-.5f)*r*5,p[1]+(rng.nextFloat()-.5f)*r*5},r*.4f);}
                    else if(i>0)ribbon(path.get(i-1),p,r,zero);else stamp(p,r);
                    if(i==path.size()-1&&path.size()>1&&!e.brush.equals("Spray"))stamp(p,r);
                }
            }
            if(e.wet&&kind==4&&!all.isEmpty()){
                float[] gravity=Math3.rotateY(new float[]{0,-1,0},-paper.yaw);float gu=Math3.dot(gravity,axes[0]),gy=Math3.dot(gravity,axes[1]),gn=Math3.dot(gravity,axes[2]);int count=Math.min(8,Math.max(1,all.size()/10));
                for(int i=0;i<count;i++){float[] p=all.get(i*(all.size()-1)/Math.max(1,count-1));double angle=p[0]*Surface.curvature(paper);float gx=(float)(gu*Math.cos(angle)+gn*Math.sin(angle));if(Math.hypot(gx,gy)<=.05)continue;float length=(.08f+rng.nextFloat()*.22f)/paper.scale;ribbon(p,p,e.width*(.12f+rng.nextFloat()*.2f)*e.scale/(e.pointSpace.equals("surface")?1:paper.scale),new float[]{gx*length,gy*length});}
            }return m;
        }
    }
}
