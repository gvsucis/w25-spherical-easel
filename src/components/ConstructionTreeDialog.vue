<template>
  <v-dialog v-model="visible" max-width="800px">
    <v-card color="#E8F5F1" theme="light" style="overflow: hidden">
      <v-card-title class="text-mint-dark">
        {{
          !isMoveModeActive ? "Load Construction Folders" : "Move Constructions"
        }}
      </v-card-title>

      <!-- Buttons at the top with space in between -->
      <div class="d-flex pa-4">
        <!-- Individual buttons with margin -->
        <v-btn
          :color="!isMoveModeActive ? '#40A082' : '#40A082'"
          :variant="!isMoveModeActive ? 'flat' : 'outlined'"
          @click="isMoveModeActive = false"
          class="mr-2 mode-btn"
          :class="{ 'active-mode-btn': !isMoveModeActive }">
          LOAD
        </v-btn>

        <v-btn
          :color="isMoveModeActive ? '#40A082' : '#40A082'"
          :variant="isMoveModeActive ? 'flat' : 'outlined'"
          @click="isMoveModeActive = true"
          class="mode-btn"
          :class="{ 'active-mode-btn': isMoveModeActive }">
          MOVE
        </v-btn>
      </div>

      <!-- Load View -->
      <div v-if="!isMoveModeActive">
        <v-card-text
          style="
            padding: 24px !important;
            max-height: 800px;
            overflow-y: auto;
            max-width: 100%;
          ">
          <div class="tree-container">
            <v-treeview
              v-model:selected="selectedFolder"
              :items="treeItems"
              hoverable
              activatable
              selectable
              item-title="title"
              color="#40A082"
              return-object
              :select-strategy="'leaf'"></v-treeview>
          </div>
        </v-card-text>
      </div>

      <!-- Move View -->
      <div v-else>
        <v-card-text style="padding: 16px !important">
          <v-row>
            <!-- Left Side Title -->
            <v-col cols="5">
              <div class="text-subtitle-1 mb-2 text-center">
                SELECT CONSTRUCTIONS
              </div>
            </v-col>

            <!-- Middle space -->
            <v-col cols="2"></v-col>

            <!-- Right Side Title -->
            <v-col cols="5">
              <div class="text-subtitle-1 mb-2 text-center">
                DESTINATION FOLDER
              </div>
            </v-col>
          </v-row>

          <v-row>
            <!-- Left Side: Source -->
            <v-col cols="5">
              <div class="tree-container">
                <v-treeview
                  v-model:selected="checkedConstructions"
                  :items="treeItems"
                  hoverable
                  selectable
                  item-title="title"
                  color="#40A082"
                  return-object></v-treeview>
              </div>
            </v-col>

            <!-- Middle: Move Button -->
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

            <!-- Right Side: Destination -->
            <v-col cols="5">
              <div class="tree-container">
                <v-treeview
                  v-model:active="targetFolder"
                  :items="treeItems"
                  hoverable
                  activatable
                  item-title="title"
                  color="#40A082"
                  return-object></v-treeview>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </div>

      <!-- Buttons at bottom -->
      <v-card-actions style="padding: 16px 24px !important">
        <v-spacer></v-spacer>
        <!-- Action button that changes based on mode -->
        <v-btn
          v-if="!isMoveModeActive"
          color="#40A082"
          class="mr-2"
          @click="handleLoadClick">
          LOAD SELECTED
        </v-btn>
        <v-btn v-else color="#40A082" class="mr-2" @click="confirmMove">
          CONFIRM MOVE
        </v-btn>
        <v-btn color="#40A082" variant="outlined" @click="visible = false">
          CLOSE
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { defineProps, defineEmits, ref, onMounted } from "vue";
import FolderActions from "@/components/FolderActions.vue";
import { VTreeview } from "vuetify/labs/VTreeview";

const props = defineProps({
  treeItems: Array // Prop for tree data
});

const visible = defineModel("visible");
const selectedFolder = defineModel("selectedFolder");

const emit = defineEmits<{
  (e: "move", checked: any, destination: string | object): void;
}>();

// State variables
const checkedConstructions = ref([]);
const targetFolder = ref([]);
const newFolderName = ref("");
const parentFolder = ref("");
const isMoveModeActive = ref(false);

// Handle Load button click
function handleLoadClick() {
  if (checkedConstructions.value && checkedConstructions.value.length > 0) {
    console.log(
      "[handleLoadClick] " + JSON.stringify(checkedConstructions.value)
    );
    selectedFolder.value = checkedConstructions.value;
    visible.value = false;
  }
}

// Handle node selection
function handleNodeSelection(value: string[]) {
  console.log("Selected node(s):", value);
}

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
