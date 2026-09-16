package com.drawin3d;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Durable data never contains an ARCore anchor handle or an OpenGL resource. */
final class SceneData {
    static final int MAX_OBJECTS=80, MAX_POINTS=4000, MAX_STROKE=384, MAX_IMAGES=6;
    static final float RADIUS=4;
    static final int MAX_JSON_BYTES=16*1024*1024;
    static class Entity {
        String id=UUID.randomUUID().toString(), type="stroke", brush="Pen", image="", pattern="solid", paperKind="watercolor", paperId="", pointSpace="object";
        float[] position={0,0,0}, normal={0,0,1}, size={.5f,.5f,.5f};
        float bend=0,pitch=0,roll=0,yaw=0, scale=1, width=.018f, alpha=1, arc=100, panelWidth=2, aspect=2;
        int color=0xff61e8c6;
        boolean wet=false, surface=false, paperVisible=true;
        final ArrayList<float[]> points=new ArrayList<>();
        Entity copy() {
            Entity e=new Entity(); e.id=id;e.type=type;e.brush=brush;e.image=image;
            e.position=position.clone();e.normal=normal.clone();e.yaw=yaw;e.scale=scale;
            e.width=width;e.alpha=alpha;e.arc=arc;e.panelWidth=panelWidth;e.aspect=aspect;
            e.color=color;e.wet=wet;e.surface=surface;e.paperVisible=paperVisible;
            e.pattern=pattern;e.size=size.clone();e.paperKind=paperKind;e.paperId=paperId;e.pointSpace=pointSpace;e.bend=bend;e.pitch=pitch;e.roll=roll;
            for(float[] p:points)e.points.add(p.clone()); return e;
        }
        JSONObject json() throws JSONException {
            JSONObject o=new JSONObject(); o.put("id",id);o.put("type",type);o.put("brush",brush);
            o.put("position",array(position));o.put("normal",array(normal));o.put("yaw",yaw);
            o.put("scale",scale);o.put("width",width);o.put("alpha",alpha);o.put("arc",arc);
            o.put("panelWidth",panelWidth);o.put("aspect",aspect);o.put("color",color);
            o.put("wet",wet);o.put("surface",surface);o.put("image",image);
            if(!pattern.equals("solid"))o.put("pattern",pattern);
            if(type.equals("paper"))o.put("paperKind",paperKind);if(!paperVisible)o.put("paperVisible",false);if(!paperId.isEmpty())o.put("paperId",paperId);
            if(pointSpace.equals("surface"))o.put("pointSpace",pointSpace);if(bend!=0)o.put("bend",bend);if(pitch!=0)o.put("pitch",pitch);if(roll!=0)o.put("roll",roll);
            if(type.equals("block"))o.put("size",array(size));
            JSONArray p=new JSONArray();for(float[] point:points)p.put(array(point));o.put("points",p);return o;
        }
    }
    static JSONArray array(float[] a) throws JSONException { JSONArray j=new JSONArray();for(float v:a)j.put(v);return j; }
    static String encode(List<Entity> scene) throws JSONException {
        int version=1;for(Entity e:scene){if(e.type.equals("block")||!e.pattern.equals("solid"))version=Math.max(2,version);if(e.type.equals("paper")||!e.paperId.isEmpty())version=Math.max(3,version);if(e.pointSpace.equals("surface")||e.bend!=0||e.pitch!=0||e.roll!=0)version=Math.max(4,version);if(e.type.equals("paper")&&!e.paperVisible)version=5;}
        JSONObject o=new JSONObject();o.put("version",version);o.put("units","metres");o.put("coordinates","right-handed-y-up");
        o.put("alignment","manual-origin-required");JSONArray es=new JSONArray();
        for(Entity e:scene)es.put(e.json());o.put("entities",es);return o.toString();
    }
    static float number(JSONObject o,String key,float min,float max) throws JSONException {
        double n=o.getDouble(key);if(!Double.isFinite(n)||n<min||n>max)throw new JSONException("Invalid "+key);return (float)n;
    }
    static float[] vector(JSONArray a,int count,float max) throws JSONException {
        if(a.length()!=count)throw new JSONException("Invalid vector length");float[] v=new float[count];
        for(int i=0;i<count;i++){double n=a.getDouble(i);if(!Double.isFinite(n)||Math.abs(n)>max)throw new JSONException("Invalid coordinate");v[i]=(float)n;}
        return v;
    }
    static ArrayList<Entity> decode(String text) throws JSONException {
        if(text.length()>MAX_JSON_BYTES)throw new JSONException("Project too large");
        JSONObject doc=new JSONObject(text);
        int version=doc.getInt("version");
        if((version!=1&&version!=2&&version!=3&&version!=4&&version!=5)||!"metres".equals(doc.getString("units"))||!"right-handed-y-up".equals(doc.getString("coordinates")))
            throw new JSONException("Unsupported project format");
        JSONArray es=doc.getJSONArray("entities");if(es.length()>MAX_OBJECTS)throw new JSONException("Object limit exceeded");
        ArrayList<Entity> result=new ArrayList<>();java.util.HashSet<String> ids=new java.util.HashSet<>();int points=0,images=0;
        for(int i=0;i<es.length();i++){
            JSONObject o=es.getJSONObject(i);Entity e=new Entity();e.id=o.getString("id");
            if(e.id.length()>100||!ids.add(e.id))throw new JSONException("Invalid or duplicate object ID");
            e.type=o.getString("type");if(!java.util.Arrays.asList("stroke","image","start","checkpoint","goal","block","paper").contains(e.type))throw new JSONException("Unknown object type");
            e.pointSpace=o.optString("pointSpace","object");if(!java.util.Arrays.asList("object","surface").contains(e.pointSpace))throw new JSONException("Unknown point space");
            e.bend=o.has("bend")?number(o,"bend",-300,300):0;e.pitch=o.has("pitch")?number(o,"pitch",-36000,36000):0;e.roll=o.has("roll")?number(o,"roll",-36000,36000):0;
            if(version<4&&(e.pointSpace.equals("surface")||e.bend!=0||e.pitch!=0||e.roll!=0))throw new JSONException("Surface coordinates require version 4");
            if(!e.type.equals("paper")&&(e.bend!=0||e.pitch!=0||e.roll!=0))throw new JSONException("Only paper has surface transforms");
            if(o.has("paperVisible")&&!(o.get("paperVisible") instanceof Boolean))throw new JSONException("Invalid paper visibility");
            e.paperVisible=o.optBoolean("paperVisible",true);if(!e.paperVisible&&(version<5||!e.type.equals("paper")))throw new JSONException("Hidden paper needs a paper entity and version 5");
            e.paperKind=o.optString("paperKind","watercolor");e.paperId=o.optString("paperId","");
            if(e.type.equals("paper")&&Paper.kind(e.paperKind)<0)throw new JSONException("Unknown paper finish");
            if(e.pointSpace.equals("surface")&&(e.paperId.isEmpty()||!e.type.equals("stroke")))throw new JSONException("Surface points need a paper reference");
            if(e.paperId.length()>100||(!e.paperId.isEmpty()&&!e.type.equals("stroke")))throw new JSONException("Invalid paper reference");
            if(version<3&&(e.type.equals("paper")||!e.paperId.isEmpty()))throw new JSONException("Paper requires version 3");
            e.pattern=o.optString("pattern","solid");if(!java.util.Arrays.asList("solid","dash","dot").contains(e.pattern))throw new JSONException("Unknown stroke pattern");
            if(version==1&&(e.type.equals("block")||!e.pattern.equals("solid")))throw new JSONException("Blocks and patterned strokes require version 2");
            if(e.type.equals("block")){e.size=vector(o.getJSONArray("size"),3,4);for(float n:e.size)if(n<.02f)throw new JSONException("Block dimension too small");}
            e.brush=o.getString("brush");if(!java.util.Arrays.asList("Pen","Marker","Neon","Spray","Water").contains(e.brush))throw new JSONException("Unknown brush");
            e.position=vector(o.getJSONArray("position"),3,RADIUS);e.normal=vector(o.getJSONArray("normal"),3,1.01f);
            if(Math3.length(e.normal)<.9f||Math3.length(e.normal)>1.1f)throw new JSONException("Invalid surface normal");
            e.normal=Math3.norm(e.normal);e.yaw=number(o,"yaw",-36000,36000);e.scale=number(o,"scale",.1f,4);
            e.width=number(o,"width",e.pointSpace.equals("surface")?.0005f:.002f,e.pointSpace.equals("surface")?1.5f:.15f);e.alpha=number(o,"alpha",.05f,1);e.arc=number(o,"arc",0,300);
            e.panelWidth=number(o,"panelWidth",.1f,4);e.aspect=number(o,"aspect",.1f,10);
            e.color=o.getInt("color");e.wet=o.getBoolean("wet");e.surface=o.getBoolean("surface");
            JSONArray ps=o.getJSONArray("points");if(ps.length()>MAX_STROKE)throw new JSONException("Stroke too long");
            for(int p=0;p<ps.length();p++){float[] v=vector(ps.getJSONArray(p),4,e.pointSpace.equals("surface")?1024:8);if(v[3]<.1f||v[3]>2)throw new JSONException("Invalid pressure");e.points.add(v);}
            if(e.pointSpace.equals("surface")&&(Math.abs(e.position[2])>1e-7||e.points.stream().anyMatch(p->Math.abs(p[2])>1e-7)))throw new JSONException("Surface points must have zero depth");
            points+=ps.length();e.image=o.optString("image","");
            if("stroke".equals(e.type)&&e.points.isEmpty())throw new JSONException("Empty stroke");
            if("image".equals(e.type)){images++;if(e.image.length()==0||e.image.length()>2*1024*1024)throw new JSONException("Image payload too large or missing");}
            else if(!e.image.isEmpty())throw new JSONException("Unexpected image payload");
            if(!withinBounds(e))throw new JSONException("Content exceeds the four-metre map radius");result.add(e);
        }
        for(Entity e:result)if(!e.paperId.isEmpty()&&result.stream().noneMatch(p->p.id.equals(e.paperId)&&p.type.equals("paper")))throw new JSONException("Missing paper reference");
        if(points>MAX_POINTS||images>MAX_IMAGES)throw new JSONException("Scene budget exceeded");return result;
    }
    static boolean withinBounds(Entity e) {
        if(e.pointSpace.equals("surface"))return true;
        float radius="block".equals(e.type)?Math3.length(e.size)*.5f:("image".equals(e.type)||"paper".equals(e.type))?e.panelWidth*(float)Math.sqrt(1+1/(e.aspect*e.aspect))*.5f:.2f;
        if("stroke".equals(e.type)){
            for(float[] p:e.points){float[] world=Math3.add(e.position,Math3.rotateY(Math3.mul(p,e.scale),e.yaw));if(Math3.length(world)>RADIUS-.35f)return false;}
            return true;
        }
        return Math3.length(e.position)+radius*e.scale<=RADIUS;
    }
}
