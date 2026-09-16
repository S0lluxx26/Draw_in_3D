package com.drawin3d;
import java.util.ArrayList;
import java.util.Collections;
/** Same bounded distance patterns as web/src/paths.js. */
final class StrokePaths {
    private static float[] lerp(float[] a,float[] b,double t){float[] p=new float[4];for(int j=0;j<4;j++)p[j]=(float)(a[j]+(b[j]-a[j])*t);return p;}
    static ArrayList<ArrayList<float[]>> of(SceneData.Entity e){
        ArrayList<ArrayList<float[]>> result=new ArrayList<>();
        if(e.pattern.equals("solid")||e.points.size()<2){result.add(e.points);return result;}
        double[] lengths=new double[e.points.size()-1];double total=0;
        for(int i=0;i<lengths.length;i++){lengths[i]=Math3.length(Math3.sub(e.points.get(i+1),e.points.get(i)));total+=lengths[i];}
        if(total<1e-6){result.add(new ArrayList<>(Collections.singletonList(e.points.get(0))));return result;}
        int budget=Math.min(64,Math.max(8,e.points.size()/2));boolean dots=e.pattern.equals("dot");
        double period=Math.max(Math.max(e.width*(dots?2.4:6),dots?.035:.09),total/budget),travelled=0,nextDot=0;
        ArrayList<float[]> current=new ArrayList<>();
        for(int i=0;i<lengths.length;i++){
            double length=lengths[i];float[] a=e.points.get(i),b=e.points.get(i+1);if(length<1e-8)continue;
            if(dots){while(nextDot<=travelled+length+1e-7){result.add(new ArrayList<>(Collections.singletonList(lerp(a,b,Math.max(0,Math.min(1,(nextDot-travelled)/length))))));nextDot+=period;}}
            else{double t=0;while(t<length-1e-8){double phase=(travelled+t+1e-9)%period;boolean on=phase<period*.62;double step=Math.min(length-t,(on?period*.62:period)-phase+1e-9);
                if(on){if(current.isEmpty())current.add(lerp(a,b,t/length));current.add(lerp(a,b,(t+step)/length));}
                else if(!current.isEmpty()){result.add(current);current=new ArrayList<>();}t+=Math.max(step,1e-8);
            }}travelled+=length;
        }
        if(!current.isEmpty())result.add(current);if(result.isEmpty())result.add(new ArrayList<>(Collections.singletonList(e.points.get(0))));return result;
    }
}
