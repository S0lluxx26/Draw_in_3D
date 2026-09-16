package com.drawin3d;

import java.util.ArrayList;

/** Unrolled sheet coordinates and bounded cylindrical deformation; matches paper.js. */
final class Surface {
    static float[][] axes(SceneData.Entity e){
        float[][] b=Paper.basis(e.normal);double p=Math.toRadians(e.pitch),r=Math.toRadians(e.roll);
        return new float[][]{combine(b,Math.cos(r),Math.sin(r),0),combine(b,-Math.sin(r)*Math.cos(p),Math.cos(r)*Math.cos(p),Math.sin(p)),combine(b,Math.sin(r)*Math.sin(p),-Math.cos(r)*Math.sin(p),Math.cos(p))};
    }
    static float[] combine(float[][] b,double x,double y,double z){return Math3.add(Math3.add(Math3.mul(b[0],(float)x),Math3.mul(b[1],(float)y)),Math3.mul(b[2],(float)z));}
    static double curvature(SceneData.Entity e){return Math.toRadians(e.bend)/e.panelWidth;}
    static float[] bend(SceneData.Entity e,float[] p,float offset){double k=curvature(e),t=p[0]*k;if(Math.abs(k)<1e-6)return new float[]{p[0],p[1],offset};return new float[]{(float)(Math.sin(t)/k-Math.sin(t)*offset),p[1],(float)(2*Math.pow(Math.sin(t/2),2)/k+Math.cos(t)*offset)};}
    static float[] world(SceneData.Entity e,float[] p,float offset){float[] q=bend(e,p,offset);return Paper.world(e,combine(axes(e),q[0],q[1],q[2]));}
    static float[] local(SceneData.Entity e,float[] world){float[] q=Math3.mul(Math3.rotateY(Math3.sub(world,e.position),-e.yaw),1/e.scale);float[][] b=axes(e);return new float[]{Math3.dot(q,b[0]),Math3.dot(q,b[1]),Math3.dot(q,b[2])};}
    static float[] coordinates(SceneData.Entity e,float[] world){float[] q=local(e,world);double k=curvature(e);return Math.abs(k)<1e-6?q:new float[]{(float)(Math.atan2(q[0]*k,1-q[2]*k)/k),q[1],0};}
    static float[] uv(SceneData.Entity e,float[] p,SceneData.Entity paper){if(!e.pointSpace.equals("surface"))return coordinates(paper,Paper.world(e,p));double a=Math.toRadians(e.yaw),c=Math.cos(a),s=Math.sin(a);return new float[]{e.position[0]+e.scale*(float)(p[0]*c-p[1]*s),e.position[1]+e.scale*(float)(p[0]*s+p[1]*c),0};}
    static SceneData.Entity localize(SceneData.Entity e,SceneData.Entity paper){
        if(e.pointSpace.equals("surface"))return e;SceneData.Entity copy=e.copy();copy.pointSpace="surface";copy.position=new float[]{0,0,0};copy.normal=new float[]{0,0,1};copy.yaw=0;copy.width=e.width/paper.scale;copy.points.clear();
        for(float[] p:e.points){float[] q=uv(e,p,paper);copy.points.add(new float[]{q[0]/e.scale,q[1]/e.scale,0,p[3]});}return copy;
    }
    static float[] hit(SceneData.Entity e,float[] origin,float[] direction){
        float[] o=local(e,origin),d=Math3.sub(local(e,Math3.add(origin,direction)),o);double k=curvature(e);double[] roots={};
        if(Math.abs(k)<1e-6){if(Math.abs(d[2])>1e-10)roots=new double[]{-o[2]/(double)d[2]};}
        else{double a=k*(d[0]*d[0]+d[2]*d[2]),b=2*(k*(o[0]*d[0]+o[2]*d[2])-d[2]),c=k*(o[0]*o[0]+o[2]*o[2])-2*o[2],disc=b*b-4*a*c;if(Math.abs(a)>1e-14&&disc>=0){double q=-.5*(b+Math.copySign(Math.sqrt(disc),b==0?1:b));roots=Math.abs(q)>1e-14?new double[]{q/a,c/q}:new double[]{-b/(2*a)};}}
        java.util.Arrays.sort(roots);for(double t:roots){if(t<0)continue;double x=o[0]+d[0]*t,y=o[1]+d[1]*t,z=o[2]+d[2]*t,u=Math.abs(k)<1e-6?x:Math.atan2(x*k,1-z*k)/k;if(Math.abs(u)<=e.panelWidth/2+1e-6&&Math.abs(y)<=e.panelWidth/e.aspect/2+1e-6){double angle=u*k;if(-Math.sin(angle)*d[0]+Math.cos(angle)*d[2]>=-1e-9)return null;return Math3.add(origin,Math3.mul(direction,(float)t));}}return null;
    }
    static ArrayList<ArrayList<float[]>> paths(SceneData.Entity e,SceneData.Entity paper){
        ArrayList<ArrayList<float[]>> paths=new ArrayList<>();int total=0;double length=0;
        for(ArrayList<float[]> source:StrokePaths.of(e)){ArrayList<float[]> path=new ArrayList<>();for(float[] p:source){float[] q=uv(e,p,paper);path.add(new float[]{q[0],q[1],p[3]});}total+=path.size();for(int i=1;i<path.size();i++)length+=Math.abs(path.get(i)[0]-path.get(i-1)[0]);paths.add(path);}
        if(Math.abs(paper.bend)<1e-4)return paths;
        double step=Math.max(paper.panelWidth*3/Math.max(1,Math.abs(paper.bend)),length/Math.max(1,1536-total));ArrayList<ArrayList<float[]>> result=new ArrayList<>();
        for(ArrayList<float[]> path:paths){ArrayList<float[]> out=new ArrayList<>();if(!path.isEmpty())out.add(path.get(0));for(int i=1;i<path.size();i++){float[] a=path.get(i-1),b=path.get(i);int n=Math.max(1,(int)Math.ceil(Math.abs(b[0]-a[0])/step));for(int j=1;j<=n;j++){float t=j/(float)n;out.add(new float[]{a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t});}}result.add(out);}return result;
    }
}
