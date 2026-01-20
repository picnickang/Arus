# How to Resolve Your Sync Conflicts

You currently have **2 pending sync conflicts** that need manual resolution. These are safety-critical sensor configuration conflicts that require you to choose which value to use.

## Current Conflicts

### Conflict 1: Sensor Threshold
- **Field:** `sensor_configurations.threshold`
- **Your Device (Local):** 95
- **Server Value:** 85
- **Type:** Safety Critical - Manual resolution required

### Conflict 2: Maximum Temperature
- **Field:** `sensor_configurations.max_temp`  
- **Your Device (Local):** 120
- **Server Value:** 110
- **Type:** Safety Critical - Manual resolution required

## How to Resolve (Simple 3-Step Process)

### Step 1: Open the Conflict Resolution Dialog
1. Look at the left sidebar in your ARUS application
2. You should see a **"Data Sync"** menu item with a **badge showing "2"**
3. Click on **"Data Sync"**

### Step 2: Review and Select Values
The Conflict Resolution modal will open showing both conflicts:

**For each conflict, you'll see:**
- The field name that's conflicting
- Two side-by-side options:
  - **Your Device** (left) - The value from your local device
  - **Server** (right) - The value from the server/other device
- Who made each change and when
- Which device made the change

**Make your choices:**
1. For the **threshold** conflict:
   - Click the radio button for either **95** (your device) or **85** (server)
   - Choose based on which threshold is correct for your sensor configuration

2. For the **max_temp** conflict:
   - Click the radio button for either **120** (your device) or **110** (server)
   - Choose the appropriate maximum temperature limit

### Step 3: Apply Resolution
1. After selecting values for BOTH conflicts, the **"Resolve 2 Conflicts"** button will become enabled
2. Click **"Resolve 2 Conflicts"**
3. You'll see a success message
4. The modal will close
5. The conflict badge will disappear

## Decision Guidance

### For Threshold (95 vs 85)
- **Choose 95** if: Higher sensitivity is needed for early warnings
- **Choose 85** if: You want to reduce false alarms with a lower threshold

### For Max Temperature (120°C vs 110°C)
- **Choose 120** if: Equipment specs allow higher operating temperature
- **Choose 110** if: You want more conservative safety margins

> 💡 **Tip:** When in doubt, choose the more conservative (safer) value:
> - Lower threshold = more sensitive (catches issues earlier)
> - Lower max temp = safer operating limits

## What Happens After Resolution

✅ **Your chosen values will be saved** to the database  
✅ **All devices will sync** to use the selected values  
✅ **Conflict records will be marked as resolved**  
✅ **The conflict badge will disappear** from the sidebar  

## Technical Details (For Reference)

These conflicts occurred because:
1. Two devices modified the same sensor configuration fields
2. The changes happened while devices were offline
3. When they synced back, the system detected conflicting values
4. Since these are safety-critical fields, automatic resolution isn't allowed
5. You must manually choose which value is correct

The conflict resolution system ensures data integrity by:
- Tracking who made changes and when
- Preventing silent overwrites of safety-critical data
- Requiring human judgment for important decisions
- Maintaining a full audit trail

---

**Need Help?** The Conflict Resolution UI is designed to be simple and safe. You can't make a wrong choice - you're just selecting which of the two existing values should be used going forward.
