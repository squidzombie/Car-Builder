import React, { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import type { Layer } from '../model/types'
import { registerAsset, setAssetUri } from '../model/assets'
import { persistAsset } from '../model/storage'
import { useEditor } from '../state/useEditor'
import { makeFillLayer, makeImageLayer, makeShapeLayer } from '../state/editorStore'

// Bottom layer panel (CLAUDE.md §4): select / reorder / rename / lock /
// hide / duplicate / delete. The list shows the TOP layer first, matching
// how people think about stacking.

const TYPE_ICON: Record<Layer['type'], string> = {
  fill: '▦',
  image: '◱',
  shape: '◆',
  path: '〰',
  stamp: '✦',
  text: 'T',
}

const ADD_CHOICES = [
  { label: '▦ Fill', make: () => makeFillLayer({ color: '#12355b' }) },
  { label: '■ Square', make: () => makeShapeLayer('square', { color: '#e63946' }) },
  { label: '● Circle', make: () => makeShapeLayer('circle', { color: '#f1c40f' }) },
  { label: '★ Star', make: () => makeShapeLayer('star5', { color: '#2ec4b6' }) },
]

export function LayerPanel() {
  const layers = useEditor((s) => s.doc[s.side].layers)
  const selectedId = useEditor((s) => s.selectedId)
  const select = useEditor((s) => s.select)
  const addLayer = useEditor((s) => s.addLayer)
  const deleteLayer = useEditor((s) => s.deleteLayer)
  const duplicateLayer = useEditor((s) => s.duplicateLayer)
  const moveLayer = useEditor((s) => s.moveLayer)
  const renameLayer = useEditor((s) => s.renameLayer)
  const setLayerProps = useEditor((s) => s.setLayerProps)

  const [adding, setAdding] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const topFirst = [...layers].reverse()

  const commitRename = () => {
    if (renamingId) renameLayer(renamingId, draftName)
    setRenamingId(null)
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Layers</Text>
        <Pressable
          style={styles.addButton}
          hitSlop={8}
          onPress={() => setAdding((v) => !v)}
        >
          <Text style={styles.addButtonText}>{adding ? '×' : '+'}</Text>
        </Pressable>
      </View>

      {adding ? (
        <View style={styles.addRow}>
          <Pressable
            style={styles.addChoice}
            onPress={async () => {
              setAdding(false)
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 1,
              })
              const asset = res.assets?.[0]
              if (res.canceled || !asset) return
              const assetId = registerAsset(asset.uri)
              // copy out of the picker cache so the photo survives restarts
              persistAsset(asset.uri, assetId)
                .then((uri) => setAssetUri(assetId, uri))
                .catch(() => {})
              addLayer(makeImageLayer(assetId, asset.width ?? 1000, asset.height ?? 1000))
            }}
          >
            <Text style={styles.addChoiceText}>◱ Photo</Text>
          </Pressable>
          {ADD_CHOICES.map((choice) => (
            <Pressable
              key={choice.label}
              style={styles.addChoice}
              onPress={() => {
                addLayer(choice.make())
                setAdding(false)
              }}
            >
              <Text style={styles.addChoiceText}>{choice.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        data={topFirst}
        keyExtractor={(l) => l.id}
        ListEmptyComponent={
          <Text style={styles.empty}>No layers yet — tap + to add one</Text>
        }
        renderItem={({ item: layer }) => {
          const selected = layer.id === selectedId
          return (
            <View style={[styles.row, selected && styles.rowSelected]}>
              <Pressable
                style={styles.rowMain}
                onPress={() => select(selected ? null : layer.id)}
                onLongPress={() => {
                  setRenamingId(layer.id)
                  setDraftName(layer.name)
                }}
              >
                <Text style={styles.typeIcon}>{TYPE_ICON[layer.type]}</Text>
                {renamingId === layer.id ? (
                  <TextInput
                    style={styles.nameInput}
                    value={draftName}
                    onChangeText={setDraftName}
                    onSubmitEditing={commitRename}
                    onBlur={commitRename}
                    autoFocus
                    selectTextOnFocus
                  />
                ) : (
                  <Text
                    style={[styles.name, !layer.visible && styles.nameHidden]}
                    numberOfLines={1}
                  >
                    {layer.name}
                  </Text>
                )}
              </Pressable>

              <Pressable
                hitSlop={6}
                style={styles.iconButton}
                onPress={() => setLayerProps(layer.id, { visible: !layer.visible })}
              >
                <Text style={styles.icon}>{layer.visible ? '👁' : '−'}</Text>
              </Pressable>
              <Pressable
                hitSlop={6}
                style={styles.iconButton}
                onPress={() => setLayerProps(layer.id, { locked: !layer.locked })}
              >
                <Text style={styles.icon}>{layer.locked ? '🔒' : '🔓'}</Text>
              </Pressable>

              {selected ? (
                <View style={styles.actions}>
                  <Pressable hitSlop={6} style={styles.iconButton} onPress={() => moveLayer(layer.id, 1)}>
                    <Text style={styles.icon}>▲</Text>
                  </Pressable>
                  <Pressable hitSlop={6} style={styles.iconButton} onPress={() => moveLayer(layer.id, -1)}>
                    <Text style={styles.icon}>▼</Text>
                  </Pressable>
                  <Pressable hitSlop={6} style={styles.iconButton} onPress={() => duplicateLayer(layer.id)}>
                    <Text style={styles.icon}>⧉</Text>
                  </Pressable>
                  <Pressable hitSlop={6} style={styles.iconButton} onPress={() => deleteLayer(layer.id)}>
                    <Text style={styles.icon}>🗑</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )
        }}
      />
      <Text style={styles.hintText}>Long-press a layer to rename</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#0d1120',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#232b42',
    maxHeight: 300,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { color: '#c9d6ea', fontSize: 15, fontWeight: '600' },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1c2233',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#c9d6ea', fontSize: 20, lineHeight: 22 },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  addChoice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#1c2233',
  },
  addChoiceText: { color: '#c9d6ea', fontSize: 13 },
  empty: { color: '#5a6478', fontSize: 13, textAlign: 'center', paddingVertical: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  rowSelected: { backgroundColor: '#18203a' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeIcon: { color: '#7f8db0', fontSize: 15, width: 20, textAlign: 'center' },
  name: { color: '#e6ecf7', fontSize: 14, flexShrink: 1 },
  nameHidden: { color: '#5a6478', textDecorationLine: 'line-through' },
  nameInput: {
    color: '#e6ecf7',
    fontSize: 14,
    flex: 1,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#3d4a6e',
  },
  iconButton: { paddingHorizontal: 6, paddingVertical: 8 },
  icon: { color: '#8fa2c7', fontSize: 14 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  hintText: { color: '#3d4560', fontSize: 11, textAlign: 'center', paddingTop: 6 },
})
