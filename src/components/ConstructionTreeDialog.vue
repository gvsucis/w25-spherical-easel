<template>
  <v-dialog v-model="visible" max-width="800px">
    <v-card color="#E8F5F1" theme="light" style="overflow: hidden">
      <v-card-title class="text-mint-dark">
        {{
          selectedTab === 0 ? "Load Construction Folders" : "Move Constructions"
        }}
      </v-card-title>

      <!-- v-tabs for navigation -->
      <v-tabs
        v-model="selectedTab"
        background-color="transparent"
        color="#40A082">
        <v-tab>LOAD</v-tab>
        <v-tab>MOVE</v-tab>
      </v-tabs>

      <v-window v-model="selectedTab">
        <!-- Load View -->
        <v-window-item :value="0">
          <v-card-text style="padding: 24px !important; max-width: 100%">
            <div class="tree-container">
              <v-treeview
                v-model:activated="loadFolderInternal"
                :items="loadFolders"
                hoverable
                activatable
                item-title="title"
                item-value="id"
                color="#40A082"
                return-object
                active-strategy="single-independent" />
            </div>
          </v-card-text>
        </v-window-item>

        <!-- Move View -->
        <v-window-item :value="1">
          <v-card-text style="padding: 16px !important">
            <v-row>
              <v-col cols="5">
                <div class="text-subtitle-1 mb-2 text-center font-weight-bold">
                  SELECT CONSTRUCTIONS
                </div>
              </v-col>
              <v-col cols="2"></v-col>
              <v-col cols="5">
                <div class="text-subtitle-1 mb-2 text-center font-weight-bold">
                  DESTINATION FOLDER
                </div>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="5">
                <div class="tree-container">
                  <v-treeview
                    v-model:selected="checkedConstructions"
                    :items="treeItems"
                    item-value="id"
                    hoverable
                    selectable
                    item-title="title"
                    color="#40A082"
                    return-object></v-treeview>
                </div>
              </v-col>

              <v-col cols="2" class="d-flex align-center justify-center">
                <v-btn
                  color="#40A082"
                  @click="confirmMove"
                  class="square-button"
                  min-width="40px"
                  width="40px"
                  height="40px">
                  <v-icon>mdi-arrow-right</v-icon>
                </v-btn>
              </v-col>

              <v-col cols="5">
                <div class="tree-container">
                  <v-treeview
                    v-model:activated="targetFolder"
                    :items="moveFolders"
                    hoverable
                    activatable
                    item-value="id"
                    item-title="title"
                    color="#40A082"
                    active-strategy="single-independent"
                    return-object />
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-window-item>
      </v-window>

      <!-- Buttons at bottom -->
      <v-card-actions style="padding: 16px 24px !important">
        <v-spacer></v-spacer>
        <v-btn
          v-if="selectedTab === 0"
          color="#40A082"
          class="mr-2"
          @click="loadSelected">
          LOAD SELECTED
        </v-btn>
        <v-btn color="#40A082" variant="outlined" @click="visible = false">
          CLOSE
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { defineEmits, ref, Ref, onMounted } from "vue";
import { VTreeview } from "vuetify/labs/VTreeview";
import { useConstructionStore } from "@/stores/construction"; // Adjust the import path as needed
import { ConstructionPath, TreeviewNode } from "@/types/ConstructionTypes";
import { watchDebounced } from "@vueuse/core";

const visible = defineModel("visible");
const loadFolder = defineModel("loadFolder");

// Get the construction store to access the constructionTree
const constructionStore = useConstructionStore();

/** folders to display in the load view */
const loadFolders: Ref<TreeviewNode[] | undefined> = ref(undefined);
/**
 * folders to display in the move view; this is different than the load view
 * so that disabled folders are only disabled in the move view.
 */
const moveFolders: Ref<TreeviewNode[] | undefined> = ref(undefined);
/** the full construction tree excluding the public branch but including all constructions. */
const treeItems: Ref<TreeviewNode[] | undefined> = ref(undefined);

const updateTreeviews = () => {
  /* recalculate and filter out public branches from all trees */
  loadFolders.value = constructionStore.constructionTree
    .getFolders()
    .filter(folder => folder.title !== "Public Constructions");
  treeItems.value = constructionStore.constructionTree
    .getRoot()
    .filter(folder => folder.title !== "Public Constructions");
  /* copy the value of loadFolders to moveFolders */
  moveFolders.value = loadFolders.value;
};

watchDebounced(
  () => constructionStore.constructionTree.updateCounter,
  _ => {
    console.debug("saw update in construction tree update counter!");
    updateTreeviews();
  },
  { debounce: 500, maxWait: 1000 }
);

const checkedConstructions = ref([]);
const targetFolder = ref([]);
const selectedTab = ref(0); // Controls v-tabs

// Confirm move action
function confirmMove() {
  console.log("got here");
  console.log("checked: " + JSON.stringify(checkedConstructions.value));
  console.log("target: " + JSON.stringify(targetFolder.value));

  if (checkedConstructions.value.length > 0 && targetFolder.value.length > 0) {
    constructionStore.moveConstructions(
      new ConstructionPath(targetFolder.value[0]),
      checkedConstructions.value[0]
    );
    visible.value = false;
  }
}

const loadFolderInternal = ref([]);

const loadSelected = () => {
  // sync the two values
  if (loadFolderInternal.value.length > 0) {
    loadFolder.value = loadFolderInternal.value[0];
  } else {
    loadFolder.value = "";
  }
  visible.value = false;
};

onMounted(updateTreeviews);
</script>

<style scoped>
:deep(.v-card-text) {
  padding: 24px !important;
  overflow: visible !important;
  max-height: none !important;
}

:deep(.v-card-actions) {
  padding: 16px 24px !important;
}

:deep(.v-text-field) {
  margin-bottom: 16px !important;
}

.selected-btn {
  font-weight: bold;
  border-width: 2px;
}

.mode-btn {
  min-width: 100px;
  font-weight: 500;
}

.active-mode-btn {
  font-weight: bold;
  background-color: #40a082 !important;
  color: white !important;
  border: none;
}

.tree-container {
  min-height: 350px;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
  background-color: white;
  white-space: nowrap;
  width: 100%;
}

:deep(.v-treeview-node__root) {
  min-width: max-content;
}

:deep(.v-treeview-node__label) {
  white-space: nowrap;
  display: inline-block;
  overflow: visible;
}

:deep(.v-treeview-node__content) {
  width: auto;
  min-width: max-content;
  overflow: visible;
}

:deep(.v-treeview) {
  overflow: visible;
  min-width: max-content;
}
</style>
