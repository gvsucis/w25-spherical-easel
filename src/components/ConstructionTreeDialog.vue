<template>
  <v-dialog
    v-model="visible"
    max-width="800px"
    >
    <v-card color="#E8F5F1" theme="light" style="overflow: hidden;">
      <v-card-title class="text-mint-dark">
        {{ selectedTab === 0 ? 'Load Construction Folders' : 'Move Constructions' }}
      </v-card-title>

      <!-- v-tabs for navigation -->
      <v-tabs v-model="selectedTab" background-color="transparent" color="#40A082">
        <v-tab>LOAD</v-tab>
        <v-tab>MOVE</v-tab>
      </v-tabs>
<!-- TODO: Remove const. nodes & reference ConstructionTree.ts -->
<v-window v-model="selectedTab">
        <!-- Load View -->
        <v-window-item :value="0">
          <v-card-text style="
            padding: 24px !important;
            max-height: 800px;
            overflow-y: auto;
            max-width: 100%;
          ">
            <div class="tree-container">
              <v-treeview
              v-model:activated="loadFolderInternal"
                :items="treeItems"
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
          <v-card-text style="padding: 16px !important;">
            <v-row>
              <v-col cols="5">
                <div class="text-subtitle-1 mb-2 text-center font-weight-bold">SELECT CONSTRUCTIONS</div>
              </v-col>
              <v-col cols="2"></v-col>
              <v-col cols="5">
                <div class="text-subtitle-1 mb-2 text-center font-weight-bold">DESTINATION FOLDER</div>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="5">
                <div class="tree-container">
                  <v-treeview
                    v-model:selected="checkedConstructions"
                    :items="treeItems"
                    hoverable
                    selectable
                    item-title="title"
                    color="#40A082"
                    return-object
                  ></v-treeview>
                </div>
              </v-col>

              <v-col cols="2" class="d-flex align-center justify-center">
                <v-btn
                  color="#40A082"
                  @click="confirmMove"
                  class="square-button"
                  min-width="40px"
                  width="40px"
                  height="40px"
                >
                  <v-icon>mdi-arrow-right</v-icon>
                </v-btn>
              </v-col>
<!-- TODO: Remove const. nodes & reference ConstructionTree.ts -->

              <v-col cols="5">
                <div class="tree-container">
                  <v-treeview
                    v-model:active="targetFolder"
                    :items="treeItems"
                    hoverable
                    activatable
                    item-title="title"
                    color="#40A082"
                    return-object
                  ></v-treeview>
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
import { defineProps, defineEmits, ref, onMounted, watch } from "vue";
import { VTreeview } from "vuetify/labs/VTreeview";

const props = defineProps({
  treeItems: Array // Prop for tree data
});

const visible = defineModel("visible");
const loadFolder = defineModel("loadFolder");

const emit = defineEmits<{
  (e: "move", checked: any, destination: string | object): void;
}>();

// State variables
const checkedConstructions = ref([]);
const targetFolder = ref([]);
const newFolderName = ref("");
const parentFolder = ref("");
const isMoveModeActive = ref(false);
const selectedTab = ref(0); // Controls v-tabs

// Handle move construction
function moveConstruction() {
  if (newFolderName.value) {
    emit("move", checkedConstructions.value, newFolderName.value);
    newFolderName.value = "";
  }
}

// Confirm move action
function confirmMove() {
  if (checkedConstructions.value.length > 0 && targetFolder.value.length > 0) {
    const destination = targetFolder.value[0];
    emit("move", checkedConstructions.value, destination);
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

onMounted(() => {
  console.log("Tree items:", props.treeItems);
});
</script>

<style scoped>
:deep(.v-card-text) {
  padding: 24px !important;
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
