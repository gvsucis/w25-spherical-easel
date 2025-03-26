<template>
    <v-dialog
      :modelValue="modelValue"
      @update:modelValue="handleUpdateModelValue"
      max-width="500px"
    >
      <v-card color="#E8F5F1" theme="light">
        <v-card-title class="text-mint-dark">
          User File System Tree
        </v-card-title>

        <FolderActions
          :newFolderName="newFolderName"
          :parentFolder="parentFolder"
          @move="moveConstruction"
        />

        <v-card-text>
          <v-treeview
            v-model:selected="checkedConstructions"
            :items="treeItems"
            hoverable
            activatable
            item-title="title"
            class="mt-4"
            color="#40A082"
            @update:active="handleNodeSelection"
            return-object
            :select-strategy="'leaf'"
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="#40A082" @click="$emit('close')">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </template>

  <script lang="ts" setup>
  import { defineProps, defineEmits, ref } from 'vue';
  import FolderActions from '@/components/FolderActions.vue';

  const props = defineProps({
    modelValue: Boolean, // Prop for dialog visibility
    treeItems: Array, // Prop for tree data
  });

  const emit = defineEmits<{
  (e: 'move', checked: any, newFolderName: string): void;
  (e: 'close'): void;
  (e: 'update:modelValue', newValue: boolean): void; // Explicitly define this event
}>();
  const checkedConstructions = ref([]); // Holds selected nodes
  const newFolderName = ref(''); // For new folder name
  const parentFolder = ref(''); // For parent folder selection

  // Handle selection of tree nodes
  function handleNodeSelection(value: string[]) {
    console.log('Selected node(s):', value);
  }

  // Handle move construction
  function moveConstruction() {
    emit('move', checkedConstructions.value, newFolderName.value);
    newFolderName.value = '';
  }

  // Emit update to parent when dialog visibility changes
  function handleUpdateModelValue(newValue: boolean) {
    emit('update:modelValue', newValue);
  }
  </script>

  <style scoped>
  /* Add dialog styles */
  </style>
