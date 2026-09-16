package com.drawin3d;

import org.junit.Test;
import static org.junit.Assert.*;

public class FrameDemandTest {
    @Test public void cameraAndDrawingStayLiveButStaticViewsSleep(){
        FrameDemand demand=new FrameDemand();
        assertFalse(demand.shouldDraw(1000,false,false));
        assertTrue(demand.shouldDraw(1000,true,false));
        assertTrue(demand.shouldDraw(1000,false,true));
        demand.wakeUntil(1400);
        assertTrue(demand.shouldDraw(1399,false,false));
        assertFalse(demand.shouldDraw(1400,false,false));
    }
    @Test public void shortInputCannotCutOffLongerWetAnimation(){
        FrameDemand demand=new FrameDemand();demand.wakeUntil(5100);demand.wakeUntil(1400);
        assertTrue(demand.shouldDraw(5000,false,false));
        assertFalse(demand.shouldDraw(5100,false,false));
    }
}
