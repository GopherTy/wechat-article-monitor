<template>
  <div class="flex bg-slate-50 dark:bg-slate-900">
    <!-- 左侧边栏 (仅桌面端) -->
    <SideBar class="hidden md:flex" />

    <!-- 移动端侧滑菜单抽屉 -->
    <USlideover v-model="isMobileMenuOpen" side="left" class="md:hidden">
      <div class="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 border-r border-slate-200 dark:border-slate-800">
        <!-- 头部 -->
        <div class="flex justify-between items-center h-[60px] border-b border-slate-100 dark:border-slate-900 mb-4 px-2">
          <NuxtLink to="/" class="font-bold text-lg text-slate-800 dark:text-slate-100" @click="isMobileMenuOpen = false">
            {{ websiteName }}
          </NuxtLink>
          <UButton
            icon="i-heroicons-x-mark"
            color="gray"
            variant="ghost"
            square
            @click="isMobileMenuOpen = false"
          />
        </div>
        <!-- 导航菜单 -->
        <div class="flex-1 overflow-y-auto pr-1">
          <NavMenus @click="isMobileMenuOpen = false" />
        </div>
        <!-- 底部面板 -->
        <div class="border-t border-slate-200 dark:border-slate-800 pt-4 mt-auto">
          <BottomPanel />
        </div>
      </div>
    </USlideover>

    <div class="flex flex-col flex-1 overflow-hidden h-screen w-full">
      <!-- 顶部操作栏 -->
      <div
        class="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-slate-6 dark:border-slate-600 px-4 md:px-6 bg-white dark:bg-slate-950 z-10"
      >
        <div class="flex items-center gap-2 overflow-hidden mr-2">
          <!-- 汉堡按钮 (仅移动端) -->
          <UButton
            icon="i-heroicons-bars-3-20-solid"
            color="gray"
            variant="ghost"
            size="sm"
            class="md:hidden"
            @click="isMobileMenuOpen = true"
          />
          <div id="title" class="truncate"></div>
        </div>
        <GlobalActions />
      </div>

      <!-- 页面容器 -->
      <div class="flex-1 overflow-hidden">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BottomPanel from '~/components/dashboard/BottomPanel.vue';
import GlobalActions from '~/components/dashboard/Actions.vue';
import NavMenus from '~/components/dashboard/NavMenus.vue';
import SideBar from '~/components/dashboard/SideBar.vue';
import { websiteName } from '~/config';

const isMobileMenuOpen = ref(false);
</script>

<style>
/* 针对手机端，将 teleport 传送过来的大标题字号进行自适应缩小 */
@media (max-width: 768px) {
  #title h1 {
    font-size: 1.125rem !important; /* text-lg */
    line-height: 1.5rem !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 160px !important;
  }
}
</style>
