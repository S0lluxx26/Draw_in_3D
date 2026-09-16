package com.drawin3d;

import java.util.concurrent.atomic.AtomicLong;

/** Bounded redraw windows for input and animation; static camera-free scenes can sleep. */
final class FrameDemand {
    private final AtomicLong awakeUntil=new AtomicLong();
    void wakeUntil(long deadlineMillis){awakeUntil.accumulateAndGet(deadlineMillis,Math::max);}
    boolean shouldDraw(long nowMillis,boolean cameraActive,boolean interacting){
        return cameraActive||interacting||nowMillis<awakeUntil.get();
    }
}
