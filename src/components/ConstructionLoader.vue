<template>
  <div class="pt-2 mr-2" id="cloader">
    <!-- Button to Show Dialog -->
    <div class="mb-4" v-if="firebaseUid && firebaseUid.length > 0">
      <v-btn
        color="#40A082"
        class="mt-4"
        @click="showDialog = true"
        block
        max-width="300px">
        Construction Organization
      </v-btn>
    </div>

    <!-- Dialog with Treeview -->
    <ConstructionTreeDialog
      v-if="firebaseUid && firebaseUid.length > 0"
      v-model:visible="showDialog"
      v-model:selected-folder="folderToLoad"
      :tree-items="treeItems"
      :checked-constructions="checkedConstructions"
      @move="" />

    <!-- Panels for Constructions -->
    <PanelsContainer :selected-folder="folderToLoad" />
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed, Ref } from "vue";
import ConstructionTreeDialog from "@/components/ConstructionTreeDialog.vue";
import PanelsContainer from "@/components/PanelsContainer.vue";
import FolderActions from "@/components/FolderActions.vue"; // Import FolderActions
import { useFolderActions } from "@/composables/useFolderActions";
import { useAccountStore } from "@/stores/account";
import { useConstructionStore } from "@/stores/construction";
import { storeToRefs } from "pinia";
import { ConstructionPath } from "@/types/ConstructionTypes";

const moveConstructionHandler = () => {
  moveConstruction(checkedConstructions.value, parentFolder.value);
};

// Store Setup
const acctStore = useAccountStore();
const constructionStore = useConstructionStore();
const { firebaseUid } = storeToRefs(acctStore);

// Tree Items for File Structure
const treeItems = computed(() => {
  return constructionStore.constructionTree.getRoot();
});

// watcher to debug updates to treeItems
watch(
  () => treeItems.value,
  newValue => {
    console.log("Tree Items Updated:", newValue);
  },
  { deep: true }
);

// Folder Actions Setup
const { checkedConstructions, moveConstruction } = useFolderActions();
const newFolderName = ref(""); // Define newFolderName in parent
const parentFolder = ref(""); // Define parentFolder in parent

// Dialog State
const showDialog = ref(false);
const folderToLoad: Ref<string> = ref("");

watch(
  () => folderToLoad.value,
  newValue => {
    console.log("[folderToload] " + JSON.stringify(newValue));
    console.log(
      "[folder contents] " +
        JSON.stringify(
          constructionStore.constructionTree.getFolderContents(
            new ConstructionPath(newValue[0])
          )
        )
    );
  },
  { deep: true }
);
</script>
