'use client'

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const HangingBoard: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer;
        let boardGroup: THREE.Group;
        let boardMeshes: THREE.Mesh[] = [];
        const clock = new THREE.Clock();
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        // 物理パラメータ
        let angularVelocity = 0;
        let currentAngle = 0.3;
        const gravity = 9.8;
        const damping = 0.98;

        // 板のパラメータ
        const longSideLength = 2.0;
        const shortSideLength = 0.6;
        const boardWidth = 0.3;
        const boardThickness = 0.08;
        const pivotOffset = 0;

        // 重りのパラメータ
        const weightRadius = 0.25;
        const weightMass = 5.0;
        const boardMass = 1.0;

        // 慣性モーメントの計算
        const longSideMoment = (boardMass * longSideLength * longSideLength) / 3;
        const shortSideMoment = (boardMass * shortSideLength * shortSideLength) / 3;
        const weightMoment = weightMass * (shortSideLength * shortSideLength);
        const totalMoment = longSideMoment + shortSideMoment + weightMoment;

        // ドラッグ関連
        let isDragging = false;
        let dragStartPoint: THREE.Vector3 | null = null;
        let dragStartAngle = 0;

        const init = () => {
            // シーンのセットアップ
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0xf0f0f0);

            camera = new THREE.PerspectiveCamera(
                50,
                containerRef.current!.clientWidth / containerRef.current!.clientHeight,
                0.1,
                1000
            );
            camera.position.set(0, 2, 6);
            camera.lookAt(0, 1.5, 0);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(containerRef.current!.clientWidth, containerRef.current!.clientHeight);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            containerRef.current!.appendChild(renderer.domElement);

            // ライティング
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
            directionalLight.position.set(5, 10, 5);
            directionalLight.castShadow = true;
            directionalLight.shadow.camera.left = -5;
            directionalLight.shadow.camera.right = 5;
            directionalLight.shadow.camera.top = 5;
            directionalLight.shadow.camera.bottom = -5;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            scene.add(directionalLight);

            // 床
            const floorGeometry = new THREE.PlaneGeometry(15, 15);
            const floorMaterial = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.8
            });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = 0;
            floor.receiveShadow = true;
            scene.add(floor);

            // 背景の壁
            const wallGeometry = new THREE.PlaneGeometry(15, 10);
            const wallMaterial = new THREE.MeshStandardMaterial({
                color: 0xe0e0e0,
                side: THREE.DoubleSide
            });
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(0, 5, -3);
            wall.receiveShadow = true;
            scene.add(wall);

            // 紐でぶら下げられた板を作成
            createBalancingBoard();

            // マウス操作
            const updateMousePosition = (clientX: number, clientY: number) => {
                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
            };

            const onMouseDown = (e: MouseEvent) => {
                updateMousePosition(e.clientX, e.clientY);

                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(boardMeshes, true);

                if (intersects.length > 0) {
                    isDragging = true;
                    dragStartPoint = intersects[0].point.clone();
                    dragStartAngle = currentAngle;
                    renderer.domElement.style.cursor = 'grabbing';
                    angularVelocity = 0;
                    e.preventDefault();
                }
            };

            const onMouseMove = (e: MouseEvent) => {
                updateMousePosition(e.clientX, e.clientY);

                if (!isDragging) {
                    raycaster.setFromCamera(mouse, camera);
                    const intersects = raycaster.intersectObjects(boardMeshes, true);
                    renderer.domElement.style.cursor = intersects.length > 0 ? 'grab' : 'default';
                } else {
                    raycaster.setFromCamera(mouse, camera);

                    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
                    const currentPoint = new THREE.Vector3();
                    raycaster.ray.intersectPlane(plane, currentPoint);

                    if (currentPoint && dragStartPoint) {
                        const pivotPos = boardGroup.position;

                        const startVec = new THREE.Vector2(
                            dragStartPoint.x - pivotPos.x,
                            dragStartPoint.y - pivotPos.y
                        );

                        const currentVec = new THREE.Vector2(
                            currentPoint.x - pivotPos.x,
                            currentPoint.y - pivotPos.y
                        );

                        const startAngle = Math.atan2(startVec.y, startVec.x);
                        const currentMouseAngle = Math.atan2(currentVec.y, currentVec.x);
                        const angleDiff = currentMouseAngle - startAngle;

                        const targetAngle = dragStartAngle + angleDiff;

                        const angleError = targetAngle - currentAngle;
                        currentAngle += angleError * 0.3;
                        angularVelocity = angleError * 3;
                    }
                }
            };

            const onMouseUp = () => {
                isDragging = false;
                dragStartPoint = null;
                renderer.domElement.style.cursor = 'default';
            };

            const onTouchStart = (e: TouchEvent) => {
                if (e.touches.length > 0) {
                    updateMousePosition(e.touches[0].clientX, e.touches[0].clientY);

                    raycaster.setFromCamera(mouse, camera);
                    const intersects = raycaster.intersectObjects(boardMeshes, true);

                    if (intersects.length > 0) {
                        isDragging = true;
                        dragStartPoint = intersects[0].point.clone();
                        dragStartAngle = currentAngle;
                        angularVelocity = 0;
                        e.preventDefault();
                    }
                }
            };

            const onTouchMove = (e: TouchEvent) => {
                if (isDragging && e.touches.length > 0) {
                    updateMousePosition(e.touches[0].clientX, e.touches[0].clientY);

                    raycaster.setFromCamera(mouse, camera);

                    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
                    const currentPoint = new THREE.Vector3();
                    raycaster.ray.intersectPlane(plane, currentPoint);

                    if (currentPoint && dragStartPoint) {
                        const pivotPos = boardGroup.position;

                        const startVec = new THREE.Vector2(
                            dragStartPoint.x - pivotPos.x,
                            dragStartPoint.y - pivotPos.y
                        );

                        const currentVec = new THREE.Vector2(
                            currentPoint.x - pivotPos.x,
                            currentPoint.y - pivotPos.y
                        );

                        const startAngle = Math.atan2(startVec.y, startVec.x);
                        const currentMouseAngle = Math.atan2(currentVec.y, currentVec.x);
                        const angleDiff = currentMouseAngle - startAngle;

                        const targetAngle = dragStartAngle + angleDiff;

                        const angleError = targetAngle - currentAngle;
                        currentAngle += angleError * 0.3;
                        angularVelocity = angleError * 3;
                    }

                    e.preventDefault();
                }
            };

            const onTouchEnd = () => {
                isDragging = false;
                dragStartPoint = null;
            };

            renderer.domElement.addEventListener('mousedown', onMouseDown);
            renderer.domElement.addEventListener('mousemove', onMouseMove);
            renderer.domElement.addEventListener('mouseup', onMouseUp);
            renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
            renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
            renderer.domElement.addEventListener('touchend', onTouchEnd);

            const handleResize = () => {
                if (!containerRef.current) return;
                camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
            };
            window.addEventListener('resize', handleResize);

            animate();

            return () => {
                window.removeEventListener('resize', handleResize);
                renderer.domElement.removeEventListener('mousedown', onMouseDown);
                renderer.domElement.removeEventListener('mousemove', onMouseMove);
                renderer.domElement.removeEventListener('mouseup', onMouseUp);
                renderer.domElement.removeEventListener('touchstart', onTouchStart);
                renderer.domElement.removeEventListener('touchmove', onTouchMove);
                renderer.domElement.removeEventListener('touchend', onTouchEnd);
            };
        };

        const createBalancingBoard = () => {
            const pivotHeight = 3;

            const pivotGeometry = new THREE.SphereGeometry(0.08);
            const pivotMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const pivotMesh = new THREE.Mesh(pivotGeometry, pivotMaterial);
            pivotMesh.position.set(0, pivotHeight, 0);
            scene.add(pivotMesh);

            const stringGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
            const stringMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
            const stringMesh = new THREE.Mesh(stringGeometry, stringMaterial);
            stringMesh.position.set(0, pivotHeight - 0.15, 0);
            stringMesh.castShadow = true;
            scene.add(stringMesh);

            boardGroup = new THREE.Group();
            boardGroup.position.set(0, pivotHeight - 0.3, 0);
            scene.add(boardGroup);

            const longGeometry = new THREE.BoxGeometry(longSideLength, boardThickness, boardWidth);
            const longMaterial = new THREE.MeshStandardMaterial({
                color: 0xd2691e,
                roughness: 0.7
            });
            const longBoard = new THREE.Mesh(longGeometry, longMaterial);
            longBoard.position.x = longSideLength / 2 + pivotOffset;
            longBoard.castShadow = true;
            longBoard.receiveShadow = true;
            boardGroup.add(longBoard);
            boardMeshes.push(longBoard);

            const shortGeometry = new THREE.BoxGeometry(shortSideLength, boardThickness, boardWidth);
            const shortMaterial = new THREE.MeshStandardMaterial({
                color: 0xd2691e,
                roughness: 0.7
            });
            const shortBoard = new THREE.Mesh(shortGeometry, shortMaterial);
            shortBoard.position.x = -shortSideLength / 2 + pivotOffset;
            shortBoard.castShadow = true;
            shortBoard.receiveShadow = true;
            boardGroup.add(shortBoard);
            boardMeshes.push(shortBoard);

            const weightGeometry = new THREE.SphereGeometry(weightRadius, 32, 32);
            const weightMaterial = new THREE.MeshStandardMaterial({
                color: 0x8b0000,
                roughness: 0.4,
                metalness: 0.6
            });
            const weightMesh = new THREE.Mesh(weightGeometry, weightMaterial);
            weightMesh.position.set(-shortSideLength + pivotOffset, -boardThickness / 2 - weightRadius * 0.7, 0);
            weightMesh.castShadow = true;
            boardGroup.add(weightMesh);
            boardMeshes.push(weightMesh);

            const jointGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 16);
            const jointMaterial = new THREE.MeshStandardMaterial({
                color: 0x444444,
                metalness: 0.8,
                roughness: 0.2
            });
            const joint = new THREE.Mesh(jointGeometry, jointMaterial);
            joint.rotation.z = Math.PI / 2;
            joint.castShadow = true;
            boardGroup.add(joint);

            boardGroup.rotation.z = currentAngle;
        };

        const updatePhysics = (deltaTime: number) => {
            const dt = Math.min(deltaTime, 0.016);

            if (!isDragging) {
                const longSideTorque = (longSideLength / 2) * boardMass * gravity * Math.sin(currentAngle);
                const shortSideTorque = -(shortSideLength / 2) * boardMass * gravity * Math.sin(currentAngle);
                const weightTorque = -shortSideLength * weightMass * gravity * Math.sin(currentAngle);

                const totalTorque = longSideTorque + shortSideTorque + weightTorque;
                const angularAcceleration = totalTorque / totalMoment;

                angularVelocity += angularAcceleration * dt;
                angularVelocity *= damping;
            } else {
                angularVelocity *= 0.8;
            }

            currentAngle += angularVelocity * dt;
// console.log(currentAngle)
            boardGroup.rotation.z = currentAngle;
        };

        const animate = () => {
            animationRef.current = requestAnimationFrame(animate);
            const deltaTime = clock.getDelta();

            updatePhysics(deltaTime);

            renderer.render(scene, camera);
        };

        init();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (containerRef.current && renderer && renderer.domElement.parentNode === containerRef.current) {
                containerRef.current.removeChild(renderer.domElement);
            }
        };
    }, []);

    return (
        <div className="w-full h-screen relative">
            <div ref={containerRef} className="w-full h-full" />
            <div className="absolute top-4 left-4 bg-white bg-opacity-90 text-gray-800 p-4 rounded-lg shadow-lg max-w-sm">
                <h2 className="text-lg font-bold mb-2">🎋 バランスを取る板</h2>
                <p className="text-sm mb-1">👆 <strong>板をクリック＆ドラッグ</strong>して動かす</p>
                <p className="text-xs text-gray-600 mt-2">
                    長い側：軽い<br />
                    短い側：重い錘付き<br />
                    赤べこのように揺れます
                </p>
            </div>
        </div>
    );
};

export default HangingBoard;