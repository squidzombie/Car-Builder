import React, { useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { Layer } from '../model/types'
import { useEditor } from '../state/useEditor'
import { color, pressed, raised, type } from './theme'
import { pressHaptic, tick } from '../view/haptics'

// Bottom layer panel (CLAUDE.md §4): select / reorder / rename / lock /
// hide / duplicate / delete. Top layer listed first. Reorder by dragging
// the grip on the right of a row (the chevrons remain for one-step
// nudges). Adding goes through the sectioned AddSheet via onAddPress.

type FeatherName = React.ComponentProps<typeof Feather>['name']

const TYPE_ICON: Record<Layer['type'], FeatherName> = {
  fill: 'square',
  image: 'image',
  shape: 'octagon',
  path: 'edit-3',
  stamp: 'star',
  text: 'type',
}

const ROW_H = 44

export function LayerPanel({ onAddPress }: { onAddPress: () => void }) {
  const layers = useEditor((s) => s.doc[s.side].layers)
  const selectedId = useEditor((s) => s.selectedId)
  const select = useEditor((s) => s.select)
  const deleteLayer = useEditor((s) => s.deleteLayer)
  const duplicateLayer = useEditor((s) => s.duplicateLayer)
  const moveLayer = useEditor((s) => s.moveLayer)
  const renameLayer = useEditor((s) => s.renameLayer)
  const setLayerProps = useEditor((s) => s.setLayerProps)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  // drag-to-reorder: which panel row is lifted and how far it has moved
  const [drag, setDrag] = useState<{ index: number; dy: number } | null>(null)

  const topFirst = [...layers].reverse()
  const n = topFirst.length
  const dropIndex = drag
    ? Math.max(0, Math.min(n - 1, Math.round(drag.index + drag.dy / ROW_H)))
    : -1

  const commitRename = () => {
    if (renamingId) renameLayer(renamingId, draftName)
    setRenamingId(null)
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Layers</Text>
        <Pressable {...pressHaptic} style={pressed(styles.addButton)} hitSlop={8} onPress={onAddPress}>
          <Feather name="plus" size={18} color={color.textMid} />
        </Pressable>
      </View>

      <ScrollView scrollEnabled={!drag} showsVerticalScrollIndicator={false}>
        {n === 0 ? <Text style={styles.empty}>No layers yet — tap + to add one</Text> : null}
        {topFirst.map((layer, index) => {
          const selected = layer.id === selectedId
          const lifted = drag?.index === index
          return (
            <View
              key={layer.id}
              style={[
                styles.row,
                selected && styles.rowSelected,
                lifted && styles.rowLifted,
                lifted && drag ? { transform: [{ translateY: drag.dy }] } : null,
                drag && !lifted && dropIndex === index && styles.rowDropTarget,
              ]}
            >
              {selected ? <View style={styles.selectedBar} /> : null}
              <Pressable
                style={styles.rowMain}
                onPress={() => select(selected ? null : layer.id)}
                onLongPress={() => {
                  setRenamingId(layer.id)
                  setDraftName(layer.name)
                }}
              >
                <Feather
                  name={TYPE_ICON[layer.type]}
                  size={14}
                  color={selected ? color.textMid : color.textDim}
                  style={styles.typeIcon}
                />
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

              <IconButton
                name={layer.visible ? 'eye' : 'eye-off'}
                dim={!layer.visible}
                onPress={() => setLayerProps(layer.id, { visible: !layer.visible })}
              />
              <IconButton
                name={layer.locked ? 'lock' : 'unlock'}
                dim={!layer.locked}
                onPress={() => setLayerProps(layer.id, { locked: !layer.locked })}
              />

              {selected ? (
                <View style={styles.actions}>
                  <IconButton name="chevron-up" onPress={() => moveLayer(layer.id, 1)} />
                  <IconButton name="chevron-down" onPress={() => moveLayer(layer.id, -1)} />
                  <IconButton name="copy" onPress={() => duplicateLayer(layer.id)} />
                  {/* delete sits apart from the cluster, behind a divider,
                      so a fat finger aiming at duplicate can't reach it */}
                  <View style={styles.actionDivider} />
                  <Pressable
                    hitSlop={6}
                    style={pressed(styles.iconButton)}
                    onPress={() => deleteLayer(layer.id)}
                  >
                    <Feather name="trash-2" size={15} color={color.danger} />
                  </Pressable>
                </View>
              ) : null}

              <DragGrip
                index={index}
                onMove={(dy) => setDrag({ index, dy })}
                onEnd={(dy) => {
                  const to = Math.max(0, Math.min(n - 1, Math.round(index + dy / ROW_H)))
                  setDrag(null)
                  // panel is top-first; the store's array is bottom-first
                  if (to !== index) useEditor.getState().moveLayerTo(layer.id, n - 1 - to)
                }}
                onCancel={() => setDrag(null)}
              />
            </View>
          )
        })}
      </ScrollView>
      <Text style={styles.hintText}>Long-press a layer to rename · drag ≡ to reorder</Text>
    </View>
  )
}

/** The reorder handle: owns its touch so the list doesn't scroll under it. */
function DragGrip({
  index,
  onMove,
  onEnd,
  onCancel,
}: {
  index: number
  onMove: (dy: number) => void
  onEnd: (dy: number) => void
  onCancel: () => void
}) {
  const cb = useRef({ onMove, onEnd, onCancel })
  cb.current = { onMove, onEnd, onCancel }
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          tick()
          cb.current.onMove(0)
        },
        onPanResponderMove: (_e, g) => cb.current.onMove(g.dy),
        onPanResponderRelease: (_e, g) => cb.current.onEnd(g.dy),
        onPanResponderTerminate: () => cb.current.onCancel(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index],
  )
  return (
    <View {...pan.panHandlers} style={styles.grip} hitSlop={6}>
      <Feather name="menu" size={15} color={color.textFaint} />
    </View>
  )
}

function IconButton({
  name,
  onPress,
  dim,
}: {
  name: FeatherName
  onPress: () => void
  dim?: boolean
}) {
  return (
    <Pressable hitSlop={6} style={pressed(styles.iconButton)} onPress={onPress}>
      <Feather name={name} size={15} color={dim ? color.textFaint : color.textDim} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: color.bg1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
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
  title: { color: color.textMid, fontSize: type.lg, fontWeight: '600' },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: color.chip,
    ...raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: color.textFaint, fontSize: type.md, textAlign: 'center', paddingVertical: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
    paddingLeft: 12,
    paddingRight: 6,
  },
  rowSelected: { backgroundColor: color.rowSelected },
  rowLifted: { backgroundColor: color.chipActive, zIndex: 10, elevation: 6, ...raised },
  rowDropTarget: { borderTopWidth: 2, borderTopColor: color.accent },
  selectedBar: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 2,
    backgroundColor: color.accent,
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 10,
    marginHorizontal: 6,
    backgroundColor: color.hairlineBright,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeIcon: { width: 18, textAlign: 'center' },
  name: { color: color.text, fontSize: type.base, flexShrink: 1 },
  nameHidden: { color: color.textFaint, textDecorationLine: 'line-through' },
  nameInput: {
    color: color.text,
    fontSize: type.base,
    flex: 1,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: color.hairlineBright,
  },
  iconButton: {
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { width: 32, height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  hintText: { color: color.textGhost, fontSize: type.xs, textAlign: 'center', paddingTop: 6 },
})
